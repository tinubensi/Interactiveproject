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

    // Find the selected plan if customer has selected one
    let selectedPlan = null;
    if (quotation.customerSelectedPlanId && plans.length > 0) {
      selectedPlan = plans.find(p => p.id === quotation.customerSelectedPlanId || p.planId === quotation.customerSelectedPlanId);
    }

    // If no snapshot exists but we have a selected plan, create it from the plan details
    if (!quotation.selectedPlanSnapshot && selectedPlan) {
      quotation.selectedPlanSnapshot = {
        planName: selectedPlan.planName,
        vendorName: selectedPlan.vendorName,
        annualPremium: selectedPlan.annualPremium,
        monthlyPremium: selectedPlan.monthlyPremium,
        currency: selectedPlan.currency,
      };
      quotation.selectedPlanPremium = selectedPlan.annualPremium;
    }

    context.log(`Retrieved quotation: ${quotation.referenceId} (leadId provided: ${!!leadId})`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          ...quotation,
          plans, // Include plans in response
          selectedPlan, // Include selected plan details
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


