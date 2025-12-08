/**
 * Delete Lead Function
 * Soft deletes a lead
 * Reference: Petli deleteLead controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function deleteLead(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_DELETE);
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');

    if (!id) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Lead ID is required'
        }
      });
    }

    if (!lineOfBusiness) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'lineOfBusiness query parameter is required'
        }
      });
    }

    // Get existing lead
    const existingLead = await cosmosService.getLeadById(id, lineOfBusiness);
    if (!existingLead) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Lead not found'
        }
      });
    }

    if (existingLead.deletedAt) {
      return withCors(request, {
        status: 410,
        jsonBody: {
          success: false,
          error: 'Lead already deleted',
          deletedAt: existingLead.deletedAt
        }
      });
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

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Lead deleted successfully',
        data: {
          lead: deletedLead
        }
      }
    });
  } catch (error: any) {
    context.error('Delete lead error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to delete lead',
        details: error.message
      }
    });
  }
}

app.http('deleteLead', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{id}',
  handler: deleteLead
});


