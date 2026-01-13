/**
 * Durable Functions Orchestrator
 * Orchestrates the plan fetching process - waits for RPA completion without blocking
 */

import * as df from 'durable-functions';

interface OrchestratorInput {
  leadId: string;
  lineOfBusiness: string;
  businessType: string;
  leadData: any;
  forceRefresh: boolean;
  requestedAt: string;
}

interface RPACompletedEvent {
  leadId: string;
  vendorId: string;
  planCount: number;
  success: boolean;
  timestamp: string;
}

const planFetchOrchestrator = df.orchestrator(function* (context) {
  const input: OrchestratorInput = context.df.getInput();
  const { leadId, lineOfBusiness, businessType, leadData } = input;

  context.log(`[Orchestrator] Started for lead ${leadId}`);

  try {
    // Step 1: Publish plans.fetch_started event
    context.log(`[Orchestrator] Publishing plans.fetch_started event`);
    yield context.df.callActivity('publishPlansFetchStarted', {
      leadId,
      lineOfBusiness,
      businessType
    });

    // Step 2: Trigger RPA to fetch plans from vendor portals
    context.log(`[Orchestrator] Triggering RPA`);
    const rpaResult = yield context.df.callActivity('triggerRPA', {
      leadId,
      lineOfBusiness,
      businessType,
      leadData
    });

    context.log(`[Orchestrator] RPA triggered: ${JSON.stringify(rpaResult)}`);

    // Step 3: Wait for RPA completion OR timeout
    // This is non-blocking - orchestrator is checkpointed and wakes up when event arrives
    const timeoutDuration = 10 * 60 * 1000; // 10 minutes
    const timeoutAt = new Date(context.df.currentUtcDateTime.getTime() + timeoutDuration);
    
    context.log(`[Orchestrator] Waiting for RPA completion or timeout at ${timeoutAt.toISOString()}`);
    
    const timeoutTask = context.df.createTimer(timeoutAt);
    const rpaCompletedTask = context.df.waitForExternalEvent('RPA_COMPLETED');

    // Race between RPA completion and timeout
    const winner = yield context.df.Task.any([rpaCompletedTask, timeoutTask]);

    let timedOut = false;
    let rpaEventData: RPACompletedEvent | null = null;

    if (winner === rpaCompletedTask) {
      // RPA completed before timeout
      timeoutTask.cancel();
      rpaEventData = winner as RPACompletedEvent;
      context.log(`[Orchestrator] ✅ RPA completed for lead ${leadId}`);
      context.log(`[Orchestrator] RPA result: ${JSON.stringify(rpaEventData)}`);
    } else {
      // Timeout occurred
      timedOut = true;
      context.log(`[Orchestrator] ⚠️ Timeout waiting for RPA (${timeoutDuration / 1000}s)`);
    }

    // Step 4: Fetch plans from database (whether RPA succeeded or timed out)
    context.log(`[Orchestrator] Fetching plans from database`);
    const plansResult = yield context.df.callActivity('fetchPlansFromDB', {
      leadId,
      lineOfBusiness
    });

    context.log(`[Orchestrator] Found ${plansResult.planCount} plans in database`);

    // Step 5: Publish plans.fetch_completed event
    context.log(`[Orchestrator] Publishing plans.fetch_completed event`);
    yield context.df.callActivity('publishPlansFetchCompleted', {
      leadId,
      lineOfBusiness,
      businessType,
      planCount: plansResult.planCount,
      plans: plansResult.plans,
      successfulVendors: plansResult.successfulVendors,
      failedVendors: plansResult.failedVendors,
      timedOut
    });

    // Return final result
    return {
      success: true,
      leadId,
      planCount: plansResult.planCount,
      timedOut,
      completedAt: new Date().toISOString()
    };

  } catch (error: any) {
    context.log(`[Orchestrator] ❌ Error for lead ${leadId}: ${error.message}`);

    // Publish failure event
    try {
      yield context.df.callActivity('publishPlansFetchFailed', {
        leadId,
        lineOfBusiness,
        error: error.message
      });
    } catch (publishError) {
      context.log(`[Orchestrator] Failed to publish error event: ${publishError}`);
    }

    // Re-throw to mark orchestration as failed
    throw error;
  }
});

df.app.orchestration('planFetchOrchestrator', planFetchOrchestrator);

export default planFetchOrchestrator;











