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
    vendorId?: string; // Optional - present in per-vendor events
    fetchRequestId?: string;
    totalPlans: number;
    successfulVendors?: string[];
    failedVendors?: string[];
    plans?: Plan[]; // Optional - plans are already saved to DB
    timestamp: Date;
    metadata?: {
      vendorTimings?: Array<{
        vendorId: string;
        vendorName: string;
        success: boolean;
        executionTime: string;
        plansCount: number;
      }>;
    };
  };
  dataVersion: string;
}

export async function handlePlansFetched(
  eventGridEvent: any,
  context: InvocationContext
): Promise<void> {
  let eventData: PlansFetchedEvent['data'] | null = null;
  let leadId: string | null = null;

  try {
    context.log('Received Event Grid event:', JSON.stringify(eventGridEvent, null, 2));
    
    // Azure Functions v4 receives Event Grid events as an array
    // The event might be: [event] or { data: [event] } or just the event object
    let events: any[] = [];
    
    if (Array.isArray(eventGridEvent)) {
      events = eventGridEvent;
    } else if (eventGridEvent.data && Array.isArray(eventGridEvent.data)) {
      events = eventGridEvent.data;
    } else if (eventGridEvent.data && eventGridEvent.data.data) {
      // Nested data structure
      events = [eventGridEvent.data];
    } else {
      // Single event object
      events = [eventGridEvent];
    }

    if (events.length === 0) {
      context.error('No events found in Event Grid payload:', eventGridEvent);
      return;
    }

    // Get the first event (should only be one for plans.fetch_completed)
    const event = events[0] as PlansFetchedEvent;
    
    // Extract data - handle different event formats
    if (event.data) {
      eventData = event.data;
    } else if (event.eventType && event.subject) {
      // Event Grid format: data is in the event itself
      eventData = event as any;
    } else {
      context.error('Invalid event format - no data found:', event);
      return;
    }

    if (!eventData) {
      context.error('Invalid event data - eventData is null');
      return;
    }

    leadId = eventData.leadId;

    if (!leadId) {
      context.error('Invalid event data - leadId missing:', eventData);
      return;
    }

    context.log(`Processing plans.fetch_completed event for lead ${leadId} with ${eventData.plans?.length || 0} plans`);

    // Get the lead first to know its LOB (partition key)
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
      parameters: [{ name: '@leadId', value: leadId }]
    };

    const { resources: leads } = await cosmosService['leadsContainer'].items.query(querySpec).fetchAll();
    
    if (leads.length === 0) {
      context.warn(`Lead ${leadId} not found - cannot update status`);
      return;
    }

    const lead = leads[0];

    // NOTE: Plans are already saved by RPA container - no need to save them again
    // RPA container publishes per-vendor events, so we query DB for actual plan count
    
    // Query all plans for this lead from Cosmos DB
    const existingPlans = await cosmosService.getPlansForLead(leadId);
    
    // Deduplicate plans by planCode to get accurate count
    // (RPA may create duplicates due to Event Grid retries or multiple triggers)
    const uniquePlanCodes = new Set(existingPlans.map(plan => plan.planCode));
    const totalPlansCount = uniquePlanCodes.size;
    
    context.log(`Found ${existingPlans.length} total plans (${totalPlansCount} unique) for lead ${leadId} in database`);

    // Update stage immediately if we have ANY plans (don't wait for multiple vendors)
    if (totalPlansCount === 0) {
      context.log(`No plans found yet for lead ${leadId} - skipping stage update`);
      context.log(`This event was from vendor: ${eventData.vendorId || 'unknown'} with ${eventData.totalPlans || 0} plans`);
      return;
    }

    context.log(`✅ Found ${totalPlansCount} plans - proceeding with stage update`);

    // Check if this lead is managed by a pipeline
    const hasPipeline = await isLeadManagedByPipeline(eventData.leadId);
    if (hasPipeline) {
      context.log(`Lead ${eventData.leadId} is managed by pipeline - skipping hardcoded stage change`);
      // Still update plan count but don't change stage
      await cosmosService.updateLead(eventData.leadId, lead.lineOfBusiness, {
        planFetchRequestId: eventData.fetchRequestId,
        plansCount: totalPlansCount,
        updatedAt: new Date()
      });
      return;
    }

    // No pipeline active - Update stage directly as fallback
    context.log(`Lead ${eventData.leadId} has no active pipeline - updating stage directly as fallback`);

    // Check if already in "Plans Available" to avoid duplicate timeline entries
    // This handles multiple vendor completion events - only the first one should create a timeline entry
    if (lead.currentStage === 'Plans Available') {
      context.log(`[DEDUP] Lead ${leadId} already in "Plans Available" stage - updating plan count only, NO timeline entry created`);
      await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
        plansCount: totalPlansCount,
        updatedAt: new Date()
      });
      return;
    }

    context.log(`[STAGE_CHANGE] Lead ${leadId} transitioning from "${lead.currentStage}" to "Plans Available" - will create timeline entry`);

    // Update lead status to "Plans Available" IMMEDIATELY
    await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
      currentStage: 'Plans Available',
      stageId: 'stage-2',
      planFetchRequestId: eventData.fetchRequestId,
      plansCount: totalPlansCount,
      updatedAt: new Date()
    });

    // Create timeline entry ONLY for actual stage change
    context.log(`[TIMELINE] Creating timeline entry for stage change: "${lead.currentStage}" → "Plans Available"`);
    await cosmosService.createTimelineEntry({
      id: uuidv4(),
      leadId: leadId,
      stage: 'Plans Available',
      previousStage: lead.currentStage,
      stageId: 'stage-2',
      remark: `${totalPlansCount} plans available (auto-updated on first extraction)`,
      changedBy: 'system',
      changedByName: 'System',
      timestamp: new Date(),
      metadata: {
        vendorTimings: eventData.metadata?.vendorTimings || []
      }
    });

    context.log(`✅ Updated lead ${leadId} to "Plans Available" stage with ${totalPlansCount} plans and created timeline entry`);

  } catch (error: any) {
    context.error('Handle plans fetched error:', error);
    
    // HTTP Fallback: If Event Grid processing fails, try HTTP direct call
    if (leadId && eventData) {
      try {
        const leadServiceUrl = process.env.LEAD_SERVICE_URL || 'https://lead-service.azurewebsites.net/api';
        context.log(`Event Grid processing failed, using HTTP fallback to save plans for lead ${leadId}`);
        
        const response = await fetch(`${leadServiceUrl}/leads/${leadId}/save-plans`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            leadId: leadId,
            fetchRequestId: eventData.fetchRequestId,
            totalPlans: eventData.plans?.length || eventData.totalPlans || 0,
            successfulVendors: eventData.successfulVendors || [],
            failedVendors: eventData.failedVendors || [],
            plans: eventData.plans || []
          })
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          context.error(`HTTP fallback also failed for lead ${leadId}: ${response.status} - ${errorText}`);
        } else {
          context.log(`HTTP fallback succeeded - plans saved for lead ${leadId}`);
        }
      } catch (httpError: any) {
        context.error(`HTTP fallback failed for lead ${leadId}:`, httpError.message);
      }
    } else {
      context.error('Cannot use HTTP fallback - missing leadId or eventData');
    }
  }
}

app.eventGrid('handlePlansFetched', {
  handler: handlePlansFetched
});
