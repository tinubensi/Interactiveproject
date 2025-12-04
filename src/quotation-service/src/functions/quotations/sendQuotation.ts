import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { pdfService } from '../../services/pdfService';
import { emailService } from '../../services/emailService';
import { eventGridService } from '../../services/eventGridService';
import { tokenService } from '../../services/tokenService';
import { SendQuotationRequest } from '../../models/quotation';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function sendQuotation(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  context.log('Processing send quotation request');

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
    const body = await request.json() as SendQuotationRequest;
    const { recipientEmail, recipientName, message } = body;

    if (!recipientEmail || !recipientName) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Recipient email and name are required',
        },
      });
    }

    // Get quotation - we need to find it first by querying
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

    // Check if quotation can be sent
    const blockedStatuses = ['approved', 'rejected', 'pending_approval', 'policy_issued'];
    if (blockedStatuses.includes(quotation.status)) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: `Cannot send quotation with status: ${quotation.status}`,
        },
      });
    }

    // Get quotation plans
    const plans = await cosmosService.getQuotationPlans(quotationId);

    context.log(`Found ${plans.length} plans for quotation ${quotationId}`);

    // Generate selection token for customer review link
    const selectionToken = tokenService.generateSelectionToken();
    context.log(`Generated selection token for quotation ${quotationId}`);

    // Construct the review link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const reviewLink = `${frontendUrl}/quotations/review/${selectionToken}`;
    context.log(`Review link: ${reviewLink}`);

    // Generate PDF
    context.log('Generating PDF...');
    const pdfBuffer = await pdfService.generateQuotationPDF({
      referenceId: quotation.referenceId,
      customerName: recipientName,
      customerEmail: recipientEmail,
      lineOfBusiness: quotation.lineOfBusiness,
      businessType: quotation.businessType,
      totalPremium: quotation.totalPremium,
      currency: quotation.currency,
      validUntil: quotation.validUntil,
      createdAt: quotation.createdAt,
      plans,
    });

    context.log(`PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Send email with PDF attachment and review link
    context.log(`Sending email to ${recipientEmail}...`);
    await emailService.sendQuotationEmail({
      to: recipientEmail,
      customerName: recipientName,
      quotationReference: quotation.referenceId,
      pdfBuffer,
      customMessage: message,
      reviewLink,
    });

    context.log('Email sent successfully');

    // Update quotation status and store the selection token
    const now = new Date();
    await cosmosService.updateQuotation(quotationId, quotation.leadId, {
      status: 'sent',
      sentAt: now,
      sentTo: recipientEmail,
      selectionToken,
    });

    context.log('Quotation status updated to sent with selection token');

    // Publish event
    try {
      await eventGridService.publishQuotationSent({
        quotationId: quotation.id,
        leadId: quotation.leadId,
        recipientEmail,
      });
      context.log('Quotation sent event published');
    } catch (eventError) {
      context.warn('Failed to publish quotation sent event:', eventError);
      // Don't fail the request if event publishing fails
    }

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Quotation sent successfully',
        data: {
          quotationId: quotation.id,
          referenceId: quotation.referenceId,
          sentTo: recipientEmail,
          sentAt: now.toISOString(),
          reviewLink,
        },
      },
    });
  } catch (error: any) {
    context.error('Error sending quotation:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to send quotation',
        details: error.message,
      },
    });
  }
}

app.http('sendQuotation', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'quotations/{id}/send',
  handler: sendQuotation,
});
