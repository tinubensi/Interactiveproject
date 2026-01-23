import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';

/**
 * Event: quotation.revision_requested
 * 
 * When a customer requests revision on a quotation:
 * - Track the quotation ID in the lead's revision history
 * - Pipeline Service handles stage changes
 */

interface QuotationRevisionRequestedEvent {
  eventType: string;
  subject: string;
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    revisionReason?: string;
    lineOfBusiness: string;
    businessType: string;
    requestedAt: string;
  };
}

export async function handleQuotationRevisionRequested(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as QuotationRevisionRequestedEvent;
    const data = event.data;

    context.log(`Received quotation.revision_requested event for lead ${data.leadId}, quotation ${data.quotationId}`);

    // Get the lead to know its LOB (partition key)
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
      parameters: [{ name: '@leadId', value: data.leadId }]
    };

    const { resources: leads } = await cosmosService['leadsContainer'].items.query(querySpec).fetchAll();
    
    if (leads.length === 0) {
      context.warn(`Lead ${data.leadId} not found`);
      return;
    }

    const lead = leads[0];

    // Add quotation ID to revision history array
    const existingRevisionIds = lead.revisionRequestedQuotationIds || [];
    
    // Only add if not already present
    if (!existingRevisionIds.includes(data.quotationId)) {
      const updatedRevisionIds = [...existingRevisionIds, data.quotationId];

      await cosmosService.updateLead(data.leadId, lead.lineOfBusiness, {
        revisionRequestedQuotationIds: updatedRevisionIds,
        updatedAt: new Date()
      });

      context.log(`Added quotation ${data.quotationId} to lead ${data.leadId} revision history`);
    } else {
      context.log(`Quotation ${data.quotationId} already in lead ${data.leadId} revision history`);
    }

    // Note: Pipeline Service handles stage changes, we only track the revision here
  } catch (error: any) {
    context.error('Handle quotation revision requested error:', error);
  }
}

app.eventGrid('handleQuotationRevisionRequested', {
  handler: handleQuotationRevisionRequested
});
