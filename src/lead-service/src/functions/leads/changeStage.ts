/**
 * Change Lead Stage Function
 * Changes the current stage of a lead
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

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

    // Get existing lead
    const existingLead = await cosmosService.getLeadById(id, lineOfBusiness);
    if (!existingLead) {
      return {
        status: 404,
        jsonBody: {
          error: 'Lead not found'
        }
      };
    }

    if (existingLead.deletedAt) {
      return {
        status: 410,
        jsonBody: {
          error: 'Cannot change stage of deleted lead'
        }
      };
    }

    // Get new stage
    const newStage = await cosmosService.getStageById(body.stageId);
    if (!newStage) {
      return {
        status: 404,
        jsonBody: {
          error: 'Stage not found'
        }
      };
    }

    // Check if stage is applicable for this LOB
    if (!newStage.applicableFor.includes(existingLead.lineOfBusiness)) {
      return {
        status: 400,
        jsonBody: {
          error: `Stage "${newStage.name}" is not applicable for ${existingLead.lineOfBusiness}`
        }
      };
    }

    // Update lead stage
    const updatedLead = await cosmosService.updateLead(id, lineOfBusiness, {
      currentStage: newStage.name,
      stageId: newStage.id
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: existingLead.id,
      stage: newStage.name,
      previousStage: existingLead.currentStage,
      stageId: newStage.id,
      remark: body.remark,
      changedBy: body.changedBy || 'user',
      changedByName: 'User', // TODO: Get from auth context
      timestamp: new Date()
    });

    // Publish lead.stage_changed event
    await eventGridService.publishLeadStageChanged({
      leadId: existingLead.id,
      referenceId: existingLead.referenceId,
      customerId: existingLead.customerId,
      oldStage: existingLead.currentStage,
      oldStageId: existingLead.stageId,
      newStage: newStage.name,
      newStageId: newStage.id,
      remark: body.remark,
      changedBy: body.changedBy,
      timestamp: new Date()
    });

    context.log(`Lead stage changed: ${existingLead.referenceId} - ${existingLead.currentStage} → ${newStage.name}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Lead stage changed successfully',
        data: {
          lead: updatedLead,
          stageChange: {
            from: existingLead.currentStage,
            to: newStage.name
          }
        }
      }
    };
  } catch (error: any) {
    context.error('Change stage error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to change lead stage',
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


