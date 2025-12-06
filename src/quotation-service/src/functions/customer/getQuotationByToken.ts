import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { tokenService } from '../../services/tokenService';
import { eventGridService } from '../../services/eventGridService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

/**
 * Public endpoint for customers to view their quotation via token
 * GET /api/customer/quotation/{token}
 */
export async function getQuotationByToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing get quotation by token request');

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
          error: 'This link has already been used. Please contact us if you need assistance.',
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

    // Get quotation plans
    const plans = await cosmosService.getQuotationPlans(quotation.id);

    context.log(`Found quotation ${quotation.referenceId} with ${plans.length} plans`);

    // Publish customer.responded event for pipeline to advance
    try {
      await eventGridService.publishEvent('customer.responded', `quotation/${quotation.id}`, {
        leadId: quotation.leadId,
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        responseType: 'viewed',
        lineOfBusiness: quotation.lineOfBusiness,
        viewedAt: new Date().toISOString(),
      });
      context.log(`Published customer.responded event for quotation ${quotation.referenceId}`);
    } catch (eventError) {
      context.warn('Failed to publish customer.responded event:', eventError);
      // Don't fail the request if event publishing fails
    }

    // Return quotation and plans (sanitized for customer view)
    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        data: {
          quotation: {
            id: quotation.id,
            referenceId: quotation.referenceId,
            lineOfBusiness: quotation.lineOfBusiness,
            businessType: quotation.businessType,
            totalPremium: quotation.totalPremium,
            currency: quotation.currency,
            validUntil: quotation.validUntil,
            createdAt: quotation.createdAt,
            // Include lead snapshot for customer info display
            customerName: quotation.leadSnapshot?.firstName 
              ? `${quotation.leadSnapshot.firstName} ${quotation.leadSnapshot.lastName || ''}`
              : 'Customer',
            customerEmail: quotation.leadSnapshot?.email || quotation.sentTo,
          },
          plans: plans.map(plan => ({
            id: plan.id,
            planId: plan.planId,
            planName: plan.planName,
            planCode: plan.planCode,
            planType: plan.planType,
            vendorName: plan.vendorName,
            annualPremium: plan.annualPremium,
            monthlyPremium: plan.monthlyPremium,
            currency: plan.currency,
            annualLimit: plan.annualLimit,
            deductible: plan.deductible,
            deductibleMetric: plan.deductibleMetric,
            coInsurance: plan.coInsurance,
            coInsuranceMetric: plan.coInsuranceMetric,
            waitingPeriod: plan.waitingPeriod,
            waitingPeriodMetric: plan.waitingPeriodMetric,
            // Include benefits if available
            benefits: plan.fullPlanData?.benefits || [],
          })),
        },
      },
    });
  } catch (error: any) {
    context.error('Error getting quotation by token:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to retrieve quotation',
        details: error.message,
      },
    });
  }
}

app.http('getQuotationByToken', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/quotation/{token}',
  handler: getQuotationByToken,
});

