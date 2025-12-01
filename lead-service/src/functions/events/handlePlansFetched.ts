/**
 * Handle Plans Fetched Event
 * Listens to plans.fetch_completed event from Quotation Generation Service
 * Updates lead with planFetchRequestId and changes stage
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService } from '../../services/cosmosService';
import { PlansFetchCompletedEvent } from '../../models/events';

export async function handlePlansFetched(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as PlansFetchCompletedEvent;
    const data = event.data;

    context.log(`Received plans.fetch_completed event for lead ${data.leadId}`);

    // Get lead - we need to query by leadId since we don't have lineOfBusiness
    // This is a limitation - we'll need to add a secondary index or query differently
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
      planFetchRequestId: data.fetchRequestId,
      currentStage: 'Plans Available',
      stageId: 'stage-2'
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: lead.id,
      stage: 'Plans Available',
      previousStage: lead.currentStage,
      stageId: 'stage-2',
      remark: `${data.totalPlans} plans fetched from ${data.successfulVendors.length} vendors`,
      changedBy: 'system',
      changedByName: 'System',
      timestamp: new Date()
    });

    context.log(`Lead updated: ${lead.referenceId} - Plans Available`);
  } catch (error: any) {
    context.error('Handle plans fetched error:', error);
    // Don't throw - let Event Grid retry
  }
}

app.eventGrid('handlePlansFetched', {
  handler: handlePlansFetched
});

