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

    // Get quotation - use efficient point read if leadId provided, otherwise query
    let quotation;
    if (leadId) {
      quotation = await cosmosService.getQuotationById(id, leadId);
    } else {
      // Staff endpoint - query by ID only (less efficient but works without partition key)
      quotation = await cosmosService.getQuotationByIdOnly(id);
    }

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

    context.log(`Retrieved quotation: ${quotation.referenceId} (leadId provided: ${!!leadId})`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: quotation // Return just the quotation object, not wrapped
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


