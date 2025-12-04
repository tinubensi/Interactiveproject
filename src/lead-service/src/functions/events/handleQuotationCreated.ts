/**
 * Handle Quotation Created Event
 * Updates lead status when quotation is created
 * Listens to quotation.created event from Quotation Service
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';

interface QuotationCreatedEvent {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: {
    quotationId: string;
    referenceId: string;
    leadId: string;
    customerId: string;
    lineOfBusiness: string;
    planIds: string[];
    totalPremium: number;
    timestamp: Date;
  };
  dataVersion: string;
}

export async function handleQuotationCreated(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as QuotationCreatedEvent;
    const data = event.data;

    context.log(`Received quotation.created event for lead ${data.leadId}`);

    // We need to get the lead first to know its LOB (partition key)
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

    // Update lead status to "Quotation Created"
    await cosmosService.updateLead(data.leadId, lead.lineOfBusiness, {
      currentStage: 'Quotation Created',
      stageId: 'stage-3',
      currentQuotationId: data.quotationId,
      isQuoteGenerated: true,
      updatedAt: new Date()
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: data.leadId,
      stage: 'Quotation Created',
      previousStage: lead.currentStage,
      stageId: 'stage-3',
      remark: `Quotation ${data.referenceId} created with ${data.planIds.length} plans`,
      changedBy: 'system',
      changedByName: 'System',
      quotationId: data.quotationId,
      timestamp: new Date()
    });

    context.log(`Lead ${data.leadId} status updated to "Quotation Created" (${data.referenceId})`);
  } catch (error: any) {
    context.error('Handle quotation created error:', error);
  }
}

app.eventGrid('handleQuotationCreated', {
  handler: handleQuotationCreated
});
