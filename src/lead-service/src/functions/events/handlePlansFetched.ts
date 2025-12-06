/**
 * Handle Plans Fetched Event
 * Updates lead status and saves plans when fetched
 * Listens to plans.fetch_completed event from Quotation Generation Service
 * 
 * NOTE: If a pipeline is active for this lead, the Pipeline Service
 * handles stage changes. This handler only saves plans and falls back
 * to hardcoded stage change when no pipeline is active.
 */

import { app, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { cosmosService, Plan } from '../../services/cosmosService';
import { isLeadManagedByPipeline } from '../../services/pipelineServiceClient';

interface PlansFetchedEvent {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: {
    leadId: string;
    fetchRequestId: string;
    totalPlans: number;
    successfulVendors: string[];
    failedVendors: string[];
    plans: Plan[]; // Plans array included in event
    timestamp: Date;
  };
  dataVersion: string;
}

export async function handlePlansFetched(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  try {
    const event = eventGridEvent as PlansFetchedEvent;
    const data = event.data;

    context.log(`Received plans.fetch_completed event for lead ${data.leadId} with ${data.plans?.length || 0} plans`);

    // We need to get the lead first to know its LOB (partition key)
    // Query to find the lead
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

    // Save plans to Lead Service DB (always do this regardless of pipeline)
    if (data.plans && data.plans.length > 0) {
      // First, delete any existing plans for this lead (in case of re-fetch)
      await cosmosService.deletePlansForLead(data.leadId);
      
      // Save new plans
      const savedPlans = await cosmosService.createPlans(data.plans);
      context.log(`Saved ${savedPlans.length} plans for lead ${data.leadId}`);
    }

    // Check if this lead is managed by a pipeline
    const hasPipeline = await isLeadManagedByPipeline(data.leadId);
    if (hasPipeline) {
      context.log(`Lead ${data.leadId} is managed by pipeline - skipping hardcoded stage change`);
      // Still update plan count but don't change stage
      await cosmosService.updateLead(data.leadId, lead.lineOfBusiness, {
        planFetchRequestId: data.fetchRequestId,
        plansCount: data.plans?.length || data.totalPlans,
        updatedAt: new Date()
      });
      return;
    }

    // Fallback: No pipeline active - use hardcoded stage change
    context.log(`Lead ${data.leadId} has no active pipeline - using hardcoded stage change`);

    // Update lead status to "Plans Available"
    await cosmosService.updateLead(data.leadId, lead.lineOfBusiness, {
      currentStage: 'Plans Available',
      stageId: 'stage-2',
      planFetchRequestId: data.fetchRequestId,
      plansCount: data.plans?.length || data.totalPlans,
      updatedAt: new Date()
    });

    // Create timeline entry
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: data.leadId,
      stage: 'Plans Available',
      previousStage: lead.currentStage,
      stageId: 'stage-2',
      remark: `${data.plans?.length || data.totalPlans} plans fetched from ${data.successfulVendors.length} vendors`,
      changedBy: 'system',
      changedByName: 'System',
      timestamp: new Date()
    });

    context.log(`Lead ${data.leadId} status updated to "Plans Available" with ${data.plans?.length || data.totalPlans} plans`);
  } catch (error: any) {
    context.error('Handle plans fetched error:', error);
  }
}

app.eventGrid('handlePlansFetched', {
  handler: handlePlansFetched
});
