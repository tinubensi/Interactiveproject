/**
 * Handle Quotation Created Event
 * Listens to quotation.created event from Quotation Service
 * Updates lead with currentQuotationId and changes stage
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { QuotationCreatedEvent } from '../../models/events';

export async function handleQuotationCreated(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as QuotationCreatedEvent;
    const data = event.data;

    context.log(`Received quotation.created event for lead ${data.leadId}`);

    // Get lead
    const query = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND NOT IS_DEFINED(c.deletedAt)',
      parameters: [{ name: '@leadId', value: data.leadId }]
    };

    const container = (cosmosService as any).leadsContainer;
    const { resources: leads } = await container.items.query(query).fetchAll();

    if (leads.length === 0) {
      context.warn(`Lead not found: ${data.leadId}`);
      return;
    }

    const lead = leads[0];

    // Update lead
    await cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
      currentQuotationId: data.quotationId,
      currentStage: 'Quotation Created',
      stageId: 'stage-3',
      isQuoteGenerated: true
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: lead.id,
      stage: 'Quotation Created',
      previousStage: lead.currentStage,
      stageId: 'stage-3',
      remark: `Quotation ${data.referenceId} created with ${data.planCount} plans`,
      changedBy: 'system',
      changedByName: 'System',
      quotationId: data.quotationId,
      timestamp: new Date()
    });

    context.log(`Lead updated: ${lead.referenceId} - Quotation Created`);
  } catch (error: any) {
    context.error('Handle quotation created error:', error);
  }
}

app.eventGrid('handleQuotationCreated', {
  handler: handleQuotationCreated
});

