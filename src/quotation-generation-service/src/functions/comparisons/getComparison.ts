/**
 * Get Comparison Function
 * Retrieves plan comparison by ID or for a lead
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS } from '../../lib/auth';

export async function getComparison(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_READ);
    const leadId = request.query.get('leadId');

    if (!leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId query parameter is required'
        }
      };
    }

    const comparison = await cosmosService.getComparisonForLead(leadId);

    if (!comparison) {
      return {
        status: 404,
        jsonBody: {
          error: 'No comparison found for this lead'
        }
      };
    }

    // Fetch the actual plans
    const plans = await Promise.all(
      comparison.planIds.map(id => cosmosService.getPlanById(id, leadId))
    );

    context.log(`Retrieved comparison for lead ${leadId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          comparison,
          plans: plans.filter(p => p !== null)
        }
      }
    };
  } catch (error: any) {
    context.error('Get comparison error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve comparison',
        details: error.message
      }
    };
  }
}

app.http('getComparison', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plans/compare',
  handler: getComparison
});


