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
    
    // CRITICAL FIX: Improved retry logic for Cosmos DB eventual consistency
    // The event might arrive before plans are queryable due to replication lag
    // Increased retries and delays to handle slower replication scenarios
    let existingPlans: Plan[] = [];
    let totalPlansCount = 0;
    const maxRetries = 5;
    const retryDelays = [1000, 2000, 3000, 5000, 8000]; // Exponential backoff: 1s, 2s, 3s, 5s, 8s
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      existingPlans = await cosmosService.getPlansForLead(leadId);
      
      // Deduplicate plans by planCode to get accurate count
      // (RPA may create duplicates due to Event Grid retries or multiple triggers)
      const uniquePlanCodes = new Set(existingPlans.map(plan => plan.planCode));
      totalPlansCount = uniquePlanCodes.size;
      
      context.log(`[Attempt ${attempt + 1}/${maxRetries}] Found ${existingPlans.length} total plans (${totalPlansCount} unique) for lead ${leadId} in database`);
      
      if (totalPlansCount > 0) {
        break; // Plans found, exit retry loop
      }
      
      // If event says plans were saved but we can't find them, retry
      if (eventData.totalPlans > 0 && attempt < maxRetries - 1) {
        const delay = retryDelays[attempt];
        context.log(`[Retry] Event reports ${eventData.totalPlans} plans but query returned 0. Retrying in ${delay}ms (Cosmos DB eventual consistency)...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else if (eventData.totalPlans > 0) {
        // Last attempt failed, but event says plans exist - use event count as fallback
        context.log(`[Fallback] Using event totalPlans (${eventData.totalPlans}) as fallback after ${maxRetries} failed queries`);
        totalPlansCount = eventData.totalPlans;
        break;
      } else if (attempt < maxRetries - 1) {
        // Event doesn't specify plan count, but this might be a per-vendor event
        // Wait a bit longer before giving up - another vendor might still be processing
        const delay = retryDelays[attempt];
        context.log(`[Retry] No plans found yet, but this might be a per-vendor event. Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // CRITICAL FIX: Handle 0 plans scenario properly
    // If this is the final aggregated event (not per-vendor) and we have 0 plans, mark as failed
    const isFinalAggregatedEvent = !eventData.vendorId; // Final event has no vendorId
    
    if (totalPlansCount === 0) {
      if (isFinalAggregatedEvent) {
        // This is the final aggregated event and we have 0 plans - all vendors failed
        context.warn(`⚠️ FINAL EVENT: All vendors failed or returned 0 plans for lead ${leadId}`);
        context.log(`Setting lead status to "Plans Fetch Failed" instead of "Plans Available"`);
        
        // Update lead to "Plans Fetch Failed" status
        await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
          currentStage: 'Plans Fetch Failed',
          stageId: 'stage-plans-fetch-failed',
          plansCount: 0,
          updatedAt: new Date()
        });
        
        // Create timeline entry
        await cosmosService.createTimelineEntry({
          id: uuidv4(),
          leadId: leadId,
          stage: 'Plans Fetch Failed',
          previousStage: lead.currentStage,
          stageId: 'stage-plans-fetch-failed',
          remark: 'All vendors failed to fetch plans or returned 0 plans',
          changedBy: 'system',
          changedByName: 'System',
          timestamp: new Date()
        });
        
        context.log(`✅ Lead ${leadId} marked as "Plans Fetch Failed" - user can retry`);
        return;
      } else {
        // This is a per-vendor event with 0 plans - wait for other vendors
        context.log(`Per-vendor event from ${eventData.vendorId} with 0 plans - waiting for other vendors`);
      return;
      }
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
      
      // CRITICAL FIX: Notify pipeline service via HTTP fallback with retry logic
      // This ensures the pipeline service receives the event even if Event Grid fails
      // Prevents leads from getting stuck in "Plans Fetching" stage
        const pipelineServiceUrl = process.env.PIPELINE_SERVICE_URL || 'https://pipeline-service.azurewebsites.net/api';
      const maxHttpRetries = 3;
      const httpRetryDelays = [1000, 2000, 3000];
      let httpSuccess = false;
      
      for (let httpAttempt = 0; httpAttempt < maxHttpRetries; httpAttempt++) {
        try {
          context.log(`[HTTP FALLBACK] Attempt ${httpAttempt + 1}/${maxHttpRetries}: Notifying pipeline service about plans.fetch_completed for lead ${eventData.leadId}`);
        
        const response = await fetch(`${pipelineServiceUrl}/events/process`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.INTERNAL_SERVICE_KEY || ''
          },
          body: JSON.stringify({
            eventType: 'plans.fetch_completed',
            leadId: eventData.leadId,
            lineOfBusiness: lead.lineOfBusiness,
            data: {
              leadId: eventData.leadId,
              fetchRequestId: eventData.fetchRequestId,
              totalPlans: totalPlansCount,
              successfulVendors: eventData.successfulVendors || [],
              failedVendors: eventData.failedVendors || [],
              metadata: eventData.metadata
            }
            }),
            signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
          if (response.ok) {
            context.log(`[HTTP FALLBACK] ✓ Successfully notified pipeline service about plans.fetch_completed`);
            httpSuccess = true;
            break;
          } else {
          const errorText = await response.text();
            context.warn(`[HTTP FALLBACK] Attempt ${httpAttempt + 1} failed: ${response.status} - ${errorText}`);
            if (httpAttempt < maxHttpRetries - 1) {
              await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
            }
          }
        } catch (httpError: any) {
          context.warn(`[HTTP FALLBACK] Attempt ${httpAttempt + 1} error: ${httpError.message}`);
          if (httpAttempt < maxHttpRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, httpRetryDelays[httpAttempt]));
        }
        }
      }
      
      if (!httpSuccess) {
        context.error(`[HTTP FALLBACK] Failed to notify pipeline service after ${maxHttpRetries} attempts. Event Grid might still deliver the event.`);
        // Don't throw - Event Grid might still deliver the event
      }
      
      // CRITICAL: Update lead status IMMEDIATELY after notifying pipeline
      // Don't wait for pipeline to call us back - update directly for faster UI response
      if (totalPlansCount > 0) {
        try {
          context.log(`[DIRECT UPDATE] Updating lead status to Plans Available immediately (${totalPlansCount} plans)`);
          await cosmosService.updateLead(eventData.leadId, lead.lineOfBusiness, {
            currentStage: 'Plans Available',
            stageId: 'stage-2',
            plansCount: totalPlansCount,
            updatedAt: new Date()
          });
          
          // Create timeline entry for the status change
          await cosmosService.createTimelineEntry({
            id: uuidv4(),
            leadId: eventData.leadId,
            stage: 'Plans Available',
            previousStage: lead.currentStage,
            stageId: 'stage-2',
            remark: `${totalPlansCount} plans fetched from ${eventData.successfulVendors?.length || 0} vendors`,
            changedBy: 'system',
            changedByName: 'System',
            timestamp: new Date()
          });
          
          context.log(`✅ DIRECT UPDATE: Lead status set to Plans Available immediately`);
        } catch (directUpdateError: any) {
          context.warn(`⚠️ Direct update failed, relying on pipeline:`, directUpdateError.message);
          // Continue - pipeline will still update via its own flow
        }
      }
      
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
