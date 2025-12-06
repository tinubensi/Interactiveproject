/**
 * Get Plan by ID Function
 * Retrieves a single plan by ID
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS } from '../../lib/auth';

export async function getPlanById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_READ);
    const id = request.params.id;
    const leadId = request.query.get('leadId');

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          error: 'Plan ID is required'
        }
      };
    }

    if (!leadId) {
      return {
        status: 400,
        jsonBody: {
          error: 'leadId query parameter is required'
        }
      };
    }

    const plan = await cosmosService.getPlanById(id, leadId);

    if (!plan) {
      return {
        status: 404,
        jsonBody: {
          error: 'Plan not found'
        }
      };
    }

    context.log(`Retrieved plan: ${plan.planName}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          plan
        }
      }
    };
  } catch (error: any) {
    context.error('Get plan by ID error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve plan',
        details: error.message
      }
    };
  }
}

app.http('getPlanById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'plans/{id}',
  handler: getPlanById
});


