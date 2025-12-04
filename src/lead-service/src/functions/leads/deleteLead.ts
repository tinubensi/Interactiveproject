/**
 * Delete Lead Function
 * Soft deletes a lead
 * Reference: Petli deleteLead controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function deleteLead(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_DELETE);
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');

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
          error: 'Lead already deleted',
          deletedAt: existingLead.deletedAt
        }
      };
    }

    // Soft delete
    const deletedLead = await cosmosService.deleteLead(id, lineOfBusiness);

    // Publish lead.deleted event
    await eventGridService.publishLeadDeleted({
      leadId: deletedLead.id,
      referenceId: deletedLead.referenceId,
      customerId: deletedLead.customerId,
      deletedBy: 'user', // TODO: Get from auth context
      deletedAt: deletedLead.deletedAt!
    });

    context.log(`Lead deleted successfully: ${deletedLead.referenceId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Lead deleted successfully',
        data: {
          lead: deletedLead
        }
      }
    };
  } catch (error: any) {
    context.error('Delete lead error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to delete lead',
        details: error.message
      }
    };
  }
}

app.http('deleteLead', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'leads/{id}',
  handler: deleteLead
});


