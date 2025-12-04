import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ApproveQuotationRequest, RejectQuotationRequest } from '../../models/quotation';
import { handlePreflight, withCors } from '../../utils/corsHelper';

/**
 * Approve a quotation that is pending approval
 * POST /api/quotations/{id}/approve
 * 
 * Changes status to 'policy_issued' and publishes event for policy creation
 */
export async function approveQuotation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing quotation approval request');

  try {
    const quotationId = request.params.id;

    if (!quotationId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Quotation ID is required',
        },
      });
    }

    // Parse request body
    let body: ApproveQuotationRequest = {};
    try {
      body = await request.json() as ApproveQuotationRequest;
    } catch {
      // Body is optional for approve
    }

    // Find quotation
    const allQuotations = await cosmosService.listQuotations({
      page: 1,
      limit: 1000,
    });

    const quotation = allQuotations.data.find(q => q.id === quotationId);

    if (!quotation) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Quotation not found',
        },
      });
    }

    // Only allow approval of quotations in pending_approval status
    if (quotation.status !== 'pending_approval') {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: `Cannot approve quotation with status: ${quotation.status}. Only quotations with 'pending_approval' status can be approved.`,
        },
      });
    }

    // Verify a plan was selected
    if (!quotation.customerSelectedPlanId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'No plan was selected by the customer',
        },
      });
    }

    // Get the selected plan details
    const plans = await cosmosService.getQuotationPlans(quotation.id);
    const selectedPlan = plans.find(p => p.id === quotation.customerSelectedPlanId);

    if (!selectedPlan) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Selected plan not found',
        },
      });
    }

    const now = new Date();

    // Update quotation status to policy_issued
    await cosmosService.updateQuotation(quotationId, quotation.leadId, {
      status: 'policy_issued',
      approvedAt: now,
    });

    context.log(`Quotation ${quotation.referenceId} approved, status changed to policy_issued`);

    // Publish event for policy creation
    try {
      await eventGridService.publishPolicyIssued({
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        leadId: quotation.leadId,
        customerId: quotation.customerId,
        selectedPlanId: selectedPlan.id,
        selectedPlanName: selectedPlan.planName,
        vendorId: selectedPlan.vendorId,
        vendorName: selectedPlan.vendorName,
        annualPremium: selectedPlan.annualPremium,
        currency: selectedPlan.currency,
        lineOfBusiness: quotation.lineOfBusiness,
        businessType: quotation.businessType,
      });
      context.log('Policy issued event published');
    } catch (eventError) {
      context.warn('Failed to publish policy issued event:', eventError);
      // Don't fail the request if event publishing fails
    }

    // Also publish the legacy quotation.approved event for any existing handlers
    try {
      await eventGridService.publishQuotationApproved({
        quotationId: quotation.id,
        leadId: quotation.leadId,
        customerId: quotation.customerId,
        selectedPlanId: selectedPlan.id,
      });
      context.log('Quotation approved event published');
    } catch (eventError) {
      context.warn('Failed to publish quotation approved event:', eventError);
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Quotation approved and policy issued',
        data: {
          quotationId: quotation.id,
          referenceId: quotation.referenceId,
          status: 'policy_issued',
          approvedAt: now.toISOString(),
          selectedPlan: {
            id: selectedPlan.id,
            name: selectedPlan.planName,
            vendor: selectedPlan.vendorName,
            annualPremium: selectedPlan.annualPremium,
            currency: selectedPlan.currency,
          },
        },
      },
    });
  } catch (error: any) {
    context.error('Error approving quotation:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to approve quotation',
        details: error.message,
      },
    });
  }
}

/**
 * Reject a quotation that is pending approval
 * POST /api/quotations/{id}/reject
 * 
 * Changes status to 'rejected'
 */
export async function rejectQuotation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing quotation rejection request');

  try {
    const quotationId = request.params.id;

    if (!quotationId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Quotation ID is required',
        },
      });
    }

    // Parse request body
    const body = await request.json() as RejectQuotationRequest;
    const { reason, remarks } = body;

    if (!reason) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Rejection reason is required',
        },
      });
    }

    // Find quotation
    const allQuotations = await cosmosService.listQuotations({
      page: 1,
      limit: 1000,
    });

    const quotation = allQuotations.data.find(q => q.id === quotationId);

    if (!quotation) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Quotation not found',
        },
      });
    }

    // Only allow rejection of quotations in pending_approval status
    if (quotation.status !== 'pending_approval') {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: `Cannot reject quotation with status: ${quotation.status}. Only quotations with 'pending_approval' status can be rejected.`,
        },
      });
    }

    const now = new Date();

    // Update quotation status to rejected
    await cosmosService.updateQuotation(quotationId, quotation.leadId, {
      status: 'rejected',
      rejectedAt: now,
      rejectionReason: reason,
    });

    context.log(`Quotation ${quotation.referenceId} rejected`);

    // Publish rejection event
    try {
      await eventGridService.publishQuotationRejected({
        quotationId: quotation.id,
        leadId: quotation.leadId,
        reason,
      });
      context.log('Quotation rejected event published');
    } catch (eventError) {
      context.warn('Failed to publish quotation rejected event:', eventError);
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Quotation rejected',
        data: {
          quotationId: quotation.id,
          referenceId: quotation.referenceId,
          status: 'rejected',
          rejectedAt: now.toISOString(),
          reason,
        },
      },
    });
  } catch (error: any) {
    context.error('Error rejecting quotation:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to reject quotation',
        details: error.message,
      },
    });
  }
}

// Register both endpoints
app.http('approveQuotation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'quotations/{id}/approve',
  handler: approveQuotation,
});

app.http('rejectQuotation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'quotations/{id}/reject',
  handler: rejectQuotation,
});

