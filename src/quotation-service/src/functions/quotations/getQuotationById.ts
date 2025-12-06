/**
 * Get Quotation by ID Function
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, QUOTATION_PERMISSIONS } from '../../lib/auth';

export async function getQuotationById(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTATIONS_READ);
    const id = request.params.id;
    const leadId = request.query.get('leadId');

    if (!id) {
      return {
        status: 400,
        jsonBody: {
          error: 'Quotation ID is required'
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

    const quotation = await cosmosService.getQuotationById(id, leadId);

    if (!quotation) {
      return {
        status: 404,
        jsonBody: {
          error: 'Quotation not found'
        }
      };
    }

    // Fetch quotation plans
    const plans = await cosmosService.getQuotationPlans(id);

    context.log(`Retrieved quotation: ${quotation.referenceId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          quotation,
          plans
        }
      }
    };
  } catch (error: any) {
    context.error('Get quotation by ID error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve quotation',
        details: error.message
      }
    };
  }
}

app.http('getQuotationById', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'quotations/{id}',
  handler: getQuotationById
});


