/**
 * Handle Plans Fetch Failed Event
 * Updates lead status when RPA plan fetching fails
 * Listens to plans.fetch_failed event from RPA Service
 */

import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { isLeadManagedByPipeline } from '../../services/pipelineServiceClient';

interface PlansFetchFailedEvent {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: {
    leadId: string;
    vendorId: string;
    error: string;
    errorType: string;
    timestamp: string;
  };
  dataVersion: string;
}

export async function handlePlansFetchFailed(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    context.log('Received plans.fetch_failed event:', JSON.stringify(eventGridEvent, null, 2));
    
    // Azure Functions v4 receives Event Grid events as an array
    const events = Array.isArray(eventGridEvent) ? eventGridEvent : [eventGridEvent];
    const event = events[0] as PlansFetchFailedEvent;
    const eventData = event.data;
    
    const { leadId, vendorId, error, errorType } = eventData;
    
    context.log(`Plans fetch failed for lead ${leadId}, vendor ${vendorId}: ${error}`);
    
    // Get lead
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
      parameters: [{ name: '@leadId', value: leadId }]
    };
    
    const { resources: leads } = await cosmosService['leadsContainer'].items
      .query(querySpec)
      .fetchAll();
    
    if (leads.length === 0) {
      context.error(`Lead ${leadId} not found`);
      return;
    }
    
    const lead = leads[0];
    
    // Check if pipeline is managing this lead
    const isPipelineManaged = await isLeadManagedByPipeline(leadId);
    
    if (isPipelineManaged) {
      context.log(`Lead ${leadId} is managed by Pipeline Service, skipping status update`);
      // Pipeline Service will handle stage changes via timeline entry
    } else {
      // Update lead status directly (without errorMessage field which doesn't exist in Lead interface)
      await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
        currentStage: 'Plans Fetch Failed',
        updatedAt: new Date()
      });
      
      context.log(`Updated lead ${leadId} status to 'Plans Fetch Failed'`);
    }
    
    // Create timeline entry (always create, regardless of pipeline management)
    // Error details are stored in remark field
    const timelineEntry = {
      id: `timeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      leadId: leadId,
      stage: 'Plans Fetch Failed',
      previousStage: lead.currentStage,
      stageId: 'error-plans-fetch',
      remark: `Failed to fetch plans from ${vendorId}: ${errorType} - ${error}`,
      changedBy: 'system',
      changedByName: 'RPA Service',
      timestamp: new Date()
    };
    
    try {
      await cosmosService.createTimelineEntry(timelineEntry);
      context.log(`Created timeline entry for lead ${leadId}`);
    } catch (timelineError) {
      context.error(`Failed to create timeline entry: ${timelineError}`);
      // Don't throw - timeline is not critical
    }
    
    context.log(`Successfully processed plans.fetch_failed event for lead ${leadId}`);
    
  } catch (error) {
    context.error('Error processing plans.fetch_failed event:', error);
    throw error;
  }
}

// Register event handler
app.eventGrid('handlePlansFetchFailed', {
  handler: handlePlansFetchFailed
});

