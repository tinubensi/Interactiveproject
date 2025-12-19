/**
 * Change Lead Stage Function
 * Emits pipeline.manual_advance event for Pipeline Service to handle
 * ALL leads must have active pipelines - direct stage updates are no longer allowed
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { eventGridService } from '../../services/eventGridService';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';
import { isLeadManagedByPipeline } from '../../services/pipelineServiceClient';

interface ChangeStageRequest {
  stageId: number;
  remark?: string;
  changedBy?: string;
}

export async function changeStage(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_UPDATE);
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');
    const body: ChangeStageRequest = await request.json() as ChangeStageRequest;

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          error: 'Lead ID is required'
        }
      };
    }

    if (!lineOfBusiness) {
      return {
        status: 400,
        jsonBody: {
          error: 'lineOfBusiness query parameter is required'
        }
      };
    }

    if (!body.stageId) {
      return {
        status: 400,
        jsonBody: {
          error: 'stageId is required'
        }
      };
    }

    // Check if lead has active pipeline - ALL leads must have pipelines now
    const hasPipeline = await isLeadManagedByPipeline(id);
    if (!hasPipeline) {
      context.error(`Lead ${id} has no active pipeline - cannot change stage. All leads must have pipelines.`);
      return {
        status: 400,
        jsonBody: {
          error: 'Pipeline required',
          message: 'Lead has no active pipeline. All leads must have active pipelines to change stages.'
        }
      };
    }

    // Get existing lead for event data
    const existingLead = await cosmosService.getLeadById(id, lineOfBusiness);
    if (!existingLead) {
      return {
        status: 404,
        jsonBody: {
          error: 'Lead not found'
        }
      };
    }

    // Get new stage for validation (we don't update directly anymore)
    const newStage = await cosmosService.getStageById(body.stageId);
    if (!newStage) {
      return {
        status: 404,
        jsonBody: {
          error: 'Stage not found'
        }
      };
    }

    // Emit pipeline.manual_advance event for Pipeline Service to handle
    await eventGridService.publishEvent(
      'pipeline.manual_advance',
      `lead/${id}`,
      {
        leadId: id,
        lineOfBusiness: lineOfBusiness,
        requestedStageId: body.stageId,
        requestedStageName: newStage.name,
        remark: body.remark,
        requestedBy: userContext.userId,
        requestedByName: userContext.name,
        timestamp: new Date().toISOString()
      }
    );

    // Emit specific events for terminal stages
    if (newStage.name === 'Lost') {
      await eventGridService.publishEvent(
        'lead.lost',
        `lead/${id}`,
        {
          leadId: id,
          referenceId: existingLead.referenceId,
          customerId: existingLead.customerId,
          lineOfBusiness: existingLead.lineOfBusiness,
          lostAt: new Date(),
          changedBy: userContext.userId,
          timestamp: new Date().toISOString()
        }
      );
    } else if (newStage.name === 'Cancelled') {
      await eventGridService.publishEvent(
        'lead.cancelled',
        `lead/${id}`,
        {
          leadId: id,
          referenceId: existingLead.referenceId,
          customerId: existingLead.customerId,
          lineOfBusiness: existingLead.lineOfBusiness,
          cancelledAt: new Date(),
          reason: body.remark || 'Cancelled by user',
          changedBy: userContext.userId,
          timestamp: new Date().toISOString()
        }
      );
    }

    context.log(`Emitted pipeline.manual_advance event for lead ${id} to stage ${newStage.name}`);

    return {
      status: 202, // Accepted - async processing
      jsonBody: {
        success: true,
        message: 'Stage change request submitted. Pipeline Service will process asynchronously.',
        data: {
          leadId: id,
          requestedStage: newStage.name,
          status: 'pending'
        }
      }
    };
  } catch (error: any) {
    context.error('Change stage error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to submit stage change request',
        details: error.message
      }
    };
  }
}

app.http('changeStage', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'leads/{id}/stage',
  handler: changeStage
});


