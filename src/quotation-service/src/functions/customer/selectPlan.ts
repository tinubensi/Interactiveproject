import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { tokenService } from '../../services/tokenService';
import { CustomerSelectPlanRequest } from '../../models/quotation';
import { handlePreflight, withCors } from '../../utils/corsHelper';

/**
 * Public endpoint for customers to select a plan from their quotation
 * POST /api/customer/quotation/{token}/select
 * 
 * After selection:
 * - Token is marked as used (one-time use)
 * - Quotation status changes to 'pending_approval'
 * - Selected plan ID is stored
 */
export async function selectPlan(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing customer plan selection request');

  try {
    const token = request.params.token;

    if (!token) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Token is required',
        },
      });
    }

    // Validate token format
    if (!tokenService.isValidTokenFormat(token)) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid token format',
        },
      });
    }

    // Parse request body
    const body = await request.json() as CustomerSelectPlanRequest;
    const { planId } = body;

    if (!planId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Plan ID is required',
        },
      });
    }

    // Find quotation by token
    const quotation = await cosmosService.getQuotationByToken(token);

    if (!quotation) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Quotation not found or link has expired',
        },
      });
    }

    // Check if token has already been used
    if (tokenService.isTokenUsed(quotation.tokenUsedAt)) {
      return withCors(request, {
        status: 410, // Gone
        jsonBody: {
          success: false,
          error: 'This link has already been used. Your selection was previously submitted.',
          used: true,
        },
      });
    }

    // Check if quotation has expired
    const now = new Date();
    const validUntil = new Date(quotation.validUntil);
    if (now > validUntil) {
      return withCors(request, {
        status: 410,
        jsonBody: {
          success: false,
          error: 'This quotation has expired. Please contact us for a new quotation.',
          expired: true,
        },
      });
    }

    // Verify the plan exists in this quotation
    const plans = await cosmosService.getQuotationPlans(quotation.id);
    const selectedPlan = plans.find(p => p.id === planId || p.planId === planId);

    if (!selectedPlan) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Selected plan is not part of this quotation',
        },
      });
    }

    context.log(`Customer selected plan ${selectedPlan.planName} for quotation ${quotation.referenceId}`);

    // Update quotation: mark token as used, store selected plan, change status
    await cosmosService.updateQuotation(quotation.id, quotation.leadId, {
      status: 'pending_approval',
      tokenUsedAt: now,
      customerSelectedPlanId: selectedPlan.id,
    });

    context.log('Quotation updated to pending_approval status');

    // Publish customer.responded event for pipeline to advance
    try {
      await eventGridService.publishEvent('customer.responded', `quotation/${quotation.id}`, {
        leadId: quotation.leadId,
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        responseType: 'plan_selected',
        lineOfBusiness: quotation.lineOfBusiness,
        selectedPlanId: selectedPlan.id,
        selectedPlanName: selectedPlan.planName,
        selectedAt: new Date().toISOString(),
      });
      context.log('Published customer.responded event (plan_selected)');
    } catch (eventError) {
      context.warn('Failed to publish customer.responded event:', eventError);
    }

    // Publish event for pending approval
    try {
      await eventGridService.publishQuotationPendingApproval({
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        leadId: quotation.leadId,
        customerId: quotation.customerId,
        selectedPlanId: selectedPlan.id,
        selectedPlanName: selectedPlan.planName,
        vendorName: selectedPlan.vendorName,
        annualPremium: selectedPlan.annualPremium,
        currency: selectedPlan.currency,
        lineOfBusiness: quotation.lineOfBusiness,
        businessType: quotation.businessType,
      });
      context.log('Pending approval event published');
    } catch (eventError) {
      context.warn('Failed to publish pending approval event:', eventError);
      // Don't fail the request if event publishing fails
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Your plan selection has been submitted successfully!',
        data: {
          quotationReference: quotation.referenceId,
          selectedPlan: {
            name: selectedPlan.planName,
            vendor: selectedPlan.vendorName,
            annualPremium: selectedPlan.annualPremium,
            currency: selectedPlan.currency,
          },
          status: 'pending_approval',
          nextSteps: 'Our team will review your selection and contact you shortly.',
        },
      },
    });
  } catch (error: any) {
    context.error('Error processing plan selection:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to process plan selection',
        details: error.message,
      },
    });
  }
}

app.http('selectPlan', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/quotation/{token}/select',
  handler: selectPlan,
});

