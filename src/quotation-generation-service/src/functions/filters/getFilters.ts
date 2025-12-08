/**
 * Get Filters Function
 * Retrieves saved filter criteria for a lead
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS } from '../../lib/auth';

export async function getFilters(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_READ);
    const leadId = request.params.leadId;

    if (!leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId is required'
        }
      };
    }

    const filter = await cosmosService.getFilter(leadId);

    if (!filter) {
      return {
        status: 404,
        jsonBody: {
          error: 'No filters found for this lead'
        }
      };
    }

    context.log(`Retrieved filters for lead ${leadId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          filter
        }
      }
    };
  } catch (error: any) {
    context.error('Get filters error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve filters',
        details: error.message
      }
    };
  }
}

app.http('getFilters', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plans/filters/{leadId}',
  handler: getFilters
});


