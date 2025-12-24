/**
 * Pipeline Action Handler for Quotation Service
 * Handles pipeline.action.send_quotation events from Pipeline Service
 */

import { app, EventGridEvent, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { emailService } from '../../services/emailService';
import { pdfService } from '../../services/pdfService';
import { tokenService } from '../../services/tokenService';
import { publishServiceCompletion } from '../../utils/publishCompletion';

/**
 * Pipeline Action Event Data Interface
 */
interface PipelineActionEventData {
  instanceId: string;
  leadId: string;
  actionData: Record<string, any>;
  metadata: {
    correlationId: string;
    pipelineId: string;
    timestamp: string;
  };
}

/**
 * Handle send_quotation action from pipeline
 * Event: pipeline.action.send_quotation
 * 
 * Expected event data:
 * - instanceId: Pipeline instance ID
 * - leadId: Lead ID
 * - actionData: { quotationId, customerEmail }
 * - metadata: { correlationId, pipelineId, timestamp }
 */
async function handleSendQuotationAction(
  event: EventGridEvent,
  context: InvocationContext
): Promise<void> {
  // Check if event data exists
  if (!event.data) {
    context.error('[PIPELINE ACTION] Event data is undefined');
    throw new Error('Event data is required but was undefined');
  }

  const eventData = event.data as unknown as PipelineActionEventData;
  const { instanceId, leadId, actionData, metadata } = eventData;

  context.log(`[PIPELINE ACTION] send_quotation for lead ${leadId} (instance: ${instanceId})`);
  context.log(`[PIPELINE ACTION] Correlation ID: ${metadata?.correlationId}`);

  try {
    // Extract action data
    const { quotationId, customerEmail } = actionData || {};

    // Validate required data
    if (!quotationId) {
      throw new Error('Missing required data: quotationId');
    }
    if (!customerEmail) {
      throw new Error('Missing required data: customerEmail');
    }
    if (!leadId) {
      throw new Error('Missing required data: leadId');
    }
    if (!instanceId) {
      throw new Error('Missing required data: instanceId');
    }

    context.log(`[PIPELINE ACTION] Quotation ID: ${quotationId}`);
    context.log(`[PIPELINE ACTION] Customer Email: ${customerEmail}`);

    // Get quotation from database
    context.log(`[PIPELINE ACTION] Fetching quotation...`);
    const quotation = await cosmosService.getQuotationById(quotationId, leadId);
    if (!quotation) {
      throw new Error(`Quotation not found: ${quotationId}`);
    }

    context.log(`[PIPELINE ACTION] Quotation found: ${quotation.referenceId}`);
    
    // Get quotation plans for PDF generation
    context.log(`[PIPELINE ACTION] Fetching quotation plans...`);
    const plans = await cosmosService.getQuotationPlans(quotationId);
    context.log(`[PIPELINE ACTION] Found ${plans.length} plans for quotation`);

    // Generate selection token for customer review link
    const selectionToken = tokenService.generateSelectionToken();
    context.log(`[PIPELINE ACTION] Generated selection token`);

    // Construct the review link
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const reviewLink = `${frontendUrl}/quotations/review/${selectionToken}`;
    context.log(`[PIPELINE ACTION] Review link: ${reviewLink}`);

    // Generate PDF
    context.log(`[PIPELINE ACTION] Generating PDF...`);
    const pdfBuffer = await pdfService.generateQuotationPDF({
      referenceId: quotation.referenceId,
      customerName: quotation.leadSnapshot?.firstName && quotation.leadSnapshot?.lastName 
        ? `${quotation.leadSnapshot.firstName} ${quotation.leadSnapshot.lastName}`
        : 'Customer',
      customerEmail,
      lineOfBusiness: quotation.lineOfBusiness,
      businessType: quotation.businessType,
      totalPremium: quotation.totalPremium,
      currency: quotation.currency,
      validUntil: quotation.validUntil,
      createdAt: quotation.createdAt,
      plans,
    });
    context.log(`[PIPELINE ACTION] PDF generated successfully, size: ${pdfBuffer.length} bytes`);

    // Send email with PDF attachment and review link
    context.log(`[PIPELINE ACTION] Sending email to ${customerEmail}...`);
    await emailService.sendQuotationEmail({
      to: customerEmail,
      customerName: quotation.leadSnapshot?.firstName && quotation.leadSnapshot?.lastName 
        ? `${quotation.leadSnapshot.firstName} ${quotation.leadSnapshot.lastName}`
        : 'Customer',
      quotationReference: quotation.referenceId,
      pdfBuffer,
      reviewLink,
    });
    context.log(`[PIPELINE ACTION] Email sent successfully`);

    // Update quotation status and store the selection token
    await cosmosService.updateQuotation(quotationId, leadId, {
      status: 'sent',
      sentAt: new Date(),
      sentTo: customerEmail,
      selectionToken,
    });

    context.log(`[PIPELINE ACTION] Quotation status updated to 'sent'`);

    // Publish service completion event
    await publishServiceCompletion({
      instanceId,
      leadId,
      actionCompleted: 'send_quotation',
      serviceName: 'quotation-service',
      correlationId: metadata?.correlationId || 'unknown',
      status: 'success',
      result: {
        quotationId,
        referenceId: quotation.referenceId,
        customerEmail,
        sentAt: new Date().toISOString(),
      },
    });

    context.log(`[PIPELINE ACTION] ✓ send_quotation completed successfully`);
    context.log(`[PIPELINE ACTION] Published service.send_quotation.completed event`);
  } catch (error: any) {
    context.error(`[PIPELINE ACTION] ✗ send_quotation failed:`, error);
    context.error(`[PIPELINE ACTION] Error message: ${error.message}`);
    context.error(`[PIPELINE ACTION] Error stack:`, error.stack);
    
    // Publish failure completion event
    try {
      await publishServiceCompletion({
        instanceId: instanceId || 'unknown',
        leadId: leadId || 'unknown',
        actionCompleted: 'send_quotation',
        serviceName: 'quotation-service',
        correlationId: metadata?.correlationId || 'unknown',
        status: 'failure',
        error: {
          code: 'SEND_FAILED',
          message: error.message || 'Unknown error',
          retryable: true,
        },
      });
      context.log(`[PIPELINE ACTION] Published service.send_quotation.failed event`);
    } catch (publishError: any) {
      context.error(`[PIPELINE ACTION] Failed to publish failure event:`, publishError.message);
    }

    // Don't throw - Event Grid will not retry if we throw
    // Pipeline service will handle timeout
  }
}

// Register Event Grid trigger
app.eventGrid('HandleSendQuotationAction', {
  handler: handleSendQuotationAction,
});
