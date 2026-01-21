/**
 * Update Quotation Plan Function
 * Updates a specific quotation plan (e.g., comment field)
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, QUOTATION_PERMISSIONS } from '../../lib/auth';

export async function updateQuotationPlan(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, QUOTATION_PERMISSIONS.QUOTATIONS_UPDATE);
    
    const quotationId = request.params.quotationId;
    const planId = request.params.planId;
    const leadId = request.query.get('leadId');
    const body = await request.json() as { comment?: string };

    if (!quotationId || !planId) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Quotation ID and Plan ID are required'
        }
      };
    }

    if (!leadId) {
      return {
        status: 400,
        jsonBody: {
          success: false,
          error: 'leadId query parameter is required'
        }
      };
    }

    // Verify quotation exists
    const quotation = await cosmosService.getQuotationById(quotationId, leadId);
    if (!quotation) {
      return {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Quotation not found'
        }
      };
    }

    // Verify plan exists and belongs to this quotation
    const plans = await cosmosService.getQuotationPlans(quotationId);
    const plan = plans.find(p => p.id === planId || p.planId === planId);
    
    if (!plan) {
      return {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Quotation plan not found'
        }
      };
    }

    // Prepare updates
    const updates: any = {};
    if (body.comment !== undefined) {
      updates.comment = body.comment;
    }

    // Update the quotation plan
    const updatedPlan = await cosmosService.updateQuotationPlan(plan.id, quotationId, updates);

    context.log(`Updated quotation plan ${planId} in quotation ${quotation.referenceId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Quotation plan updated successfully',
        data: updatedPlan
      }
    };
  } catch (error: any) {
    context.error('Update quotation plan error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to update quotation plan',
        details: error.message
      }
    };
  }
}

app.http('updateQuotationPlan', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'quotations/{quotationId}/plans/{planId}',
  handler: updateQuotationPlan
});
