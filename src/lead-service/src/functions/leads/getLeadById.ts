/**
 * Get Lead By ID Function
 * Retrieves a single lead by ID
 * Reference: Petli getLeadById controller
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, LEAD_PERMISSIONS } from '../../lib/auth';

export async function getLeadById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, LEAD_PERMISSIONS.LEADS_READ);
    const id = request.params.id;
    const lineOfBusiness = request.query.get('lineOfBusiness');

    if (!id) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'Lead ID is required'
        }
      });
    }

    if (!lineOfBusiness) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          error: 'lineOfBusiness query parameter is required'
        }
      });
    }

    // Get lead from Cosmos DB
    const lead = await cosmosService.getLeadById(id, lineOfBusiness);

    if (!lead) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          error: 'Lead not found'
        }
      });
    }

    // Check if soft deleted
    if (lead.deletedAt) {
      return withCors(request, {
        status: 410,
        jsonBody: {
          error: 'Lead has been deleted',
          deletedAt: lead.deletedAt
        }
      });
    }

    // Get timeline
    const timeline = await cosmosService.getLeadTimeline(id);

    context.log(`Retrieved lead: ${lead.referenceId}`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          lead,
          timeline
        }
      }
    });
  } catch (error: any) {
    context.error('Get lead by ID error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve lead',
        details: error.message
      }
    });
  }
}

app.http('getLeadById', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{id}',
  handler: getLeadById
});


