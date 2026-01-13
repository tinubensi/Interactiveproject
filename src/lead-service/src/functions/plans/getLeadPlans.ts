/**
 * Get Lead Plans Function
 * Returns all plans for a specific lead from Lead Service DB
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function getLeadPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const leadId = request.params.leadId;

    if (!leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'leadId is required'
        }
      });
    }

    // Get plans from Lead Service DB
    const allPlans = await cosmosService.getPlansForLead(leadId);
    
    // Deduplicate plans by planCode (keep the most recent one)
    // This handles duplicates from Event Grid retries or multiple RPA triggers
    const plansByCode = new Map<string, typeof allPlans[0]>();
    for (const plan of allPlans) {
      const existing = plansByCode.get(plan.planCode);
      // Keep the plan with the latest fetchedAt timestamp
      if (!existing || new Date(plan.fetchedAt) > new Date(existing.fetchedAt)) {
        plansByCode.set(plan.planCode, plan);
      }
    }
    
    const plans = Array.from(plansByCode.values());
    const count = plans.length;

    context.log(`Retrieved ${allPlans.length} plans (${count} unique) for lead ${leadId}`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: plans,
        pagination: {
          page: 1,
          limit: count,
          totalRecords: count,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false
        }
      }
    });
  } catch (error: any) {
    context.error('Get lead plans error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to get plans',
        details: error.message
      }
    });
  }
}

app.http('getLeadPlans', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'leads/{leadId}/plans',
  handler: getLeadPlans
});

