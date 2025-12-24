import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { tokenService } from '../../services/tokenService';
import { handlePreflight, withCors } from '../../utils/corsHelper';

/**
 * Public endpoint for customers to request revision of their quotation
 * POST /api/customer/quotation/{token}/request-revision
 * 
 * After revision request:
 * - Token is marked as used (one-time use)
 * - Quotation status changes to 'revision_requested'
 * - Revision reason is stored
 */
export async function requestRevision(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing customer revision request');

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

    const revisionReason = body.reason || 'Customer requested changes to quotation';

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

    context.log(`Customer requested revision for quotation ${quotation.referenceId}`);

    // Update quotation: mark token as used, change status to revision_requested
    await cosmosService.updateQuotation(quotation.id, quotation.leadId, {
      status: 'revision_requested',
      tokenUsedAt: now,
      revisionReason: revisionReason,
    });

    context.log('Quotation updated to revision_requested status');

    // Publish customer.responded event for pipeline to advance
    try {
      await eventGridService.publishEvent('customer.responded', `quotation/${quotation.id}`, {
        leadId: quotation.leadId,
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        responseType: 'request_revision',
        lineOfBusiness: quotation.lineOfBusiness,
        revisionReason: revisionReason,
        requestedAt: new Date().toISOString(),
      });
      context.log('Published customer.responded event (request_revision)');
    } catch (eventError) {
      context.warn('Failed to publish customer.responded event:', eventError);
    }

    // Publish quotation.revision_requested event
    try {
      await eventGridService.publishEvent('quotation.revision_requested', `quotation/${quotation.id}`, {
        quotationId: quotation.id,
        referenceId: quotation.referenceId,
        leadId: quotation.leadId,
        customerId: quotation.customerId,
        revisionReason: revisionReason,
        lineOfBusiness: quotation.lineOfBusiness,
        businessType: quotation.businessType,
        requestedAt: new Date().toISOString(),
      });
      context.log('Published quotation.revision_requested event');
    } catch (eventError) {
      context.warn('Failed to publish quotation.revision_requested event:', eventError);
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Revision request submitted successfully',
        quotation: {
          id: quotation.id,
          referenceId: quotation.referenceId,
          status: 'revision_requested',
        },
      },
    });
  } catch (error: any) {
    context.error('Error processing revision request:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: error.message || 'Failed to process revision request',
      },
    });
  }
}

app.http('RequestRevision', {
  methods: ['POST', 'OPTIONS'],
  route: 'customer/quotation/{token}/request-revision',
  handler: requestRevision,
});

