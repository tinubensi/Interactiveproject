import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { tokenService } from '../../services/tokenService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

/**
 * Public endpoint for customers to reject all plans in their quotation
 * POST /api/customer/quotation/{token}/reject
 * 
 * After rejection:
 * - Token is marked as used (one-time use)
 * - Quotation status changes to 'rejected'
 * - Rejection reason is stored
 */
export async function rejectPlans(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing customer plan rejection');

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
    let body: { reason?: string } = {};
    try {
      body = await request.json() as { reason?: string };
    } catch {
      // Body is optional
    }

    const rejectionReason = body.reason || 'Customer rejected all plans';

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
        status: 410,
        jsonBody: {
          success: false,
          error: 'This quotation link has already been used',
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

    context.log(`Customer rejected plans for quotation ${quotation.referenceId}`);

    // Update quotation: mark token as used, change status to rejected
    await cosmosService.updateQuotation(quotation.id, quotation.leadId, {
      status: 'rejected',
      tokenUsedAt: now,
      rejectionReason: rejectionReason,
    });

    context.log('Quotation updated to rejected status');

    // Publish customer.responded event for pipeline to advance
    try {
      await eventGridService.publishEvent('customer.responded', `quotation/${quotation.id}`, {
        leadId: quotation.leadId,
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        responseType: 'reject_plans',
        lineOfBusiness: quotation.lineOfBusiness,
        rejectionReason: rejectionReason,
        rejectedAt: new Date().toISOString(),
      });
      context.log('Published customer.responded event (reject_plans)');
    } catch (eventError) {
      context.warn('Failed to publish customer.responded event:', eventError);
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Plan rejection submitted successfully',
        quotation: {
          id: quotation.id,
          referenceId: quotation.referenceId,
          status: 'rejected',
        },
      },
    });
  } catch (error: any) {
    context.error('Error processing plan rejection:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message || 'Failed to process plan rejection',
      },
    });
  }
}

app.http('RejectPlans', {
  methods: ['POST', 'OPTIONS'],
  route: 'customer/quotation/{token}/reject',
  handler: rejectPlans,
});

