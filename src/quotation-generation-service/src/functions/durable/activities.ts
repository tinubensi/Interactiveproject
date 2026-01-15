/**
 * Durable Functions Activity Functions
 * Individual tasks called by the orchestrator
 */

import * as df from 'durable-functions';
import { eventGridService } from '../../services/eventGridService';
import { rpaService } from '../../services/rpaService';
import { cosmosService } from '../../services/cosmosService';
import { planFetchingService } from '../../services/planFetchingService';
import { notifyPipelineService } from '../../utils/pipelineFallback';

// =============================================================================
// Activity 1: Publish plans.fetch_started event
// =============================================================================
const publishPlansFetchStarted = df.activity(async (input: {
  leadId: string;
  lineOfBusiness: string;
  businessType: string;
}) => {
  console.log(`[Activity] Publishing plans.fetch_started for lead ${input.leadId}`);

  try {
    // Get vendor count
    const vendors = await cosmosService.getVendorsByLOB(input.lineOfBusiness as any);

    // Publish to Event Grid
    await eventGridService.publishPlansFetchStarted({
      leadId: input.leadId,
      fetchRequestId: `fetch-${input.leadId}-${Date.now()}`,
      lineOfBusiness: input.lineOfBusiness as any,
      vendorCount: vendors.length
    });

    console.log(`[Activity] ✅ plans.fetch_started event published`);

    // HTTP Fallback to Pipeline Service
    try {
      await notifyPipelineService('plans.fetch_started', {
        leadId: input.leadId,
        lineOfBusiness: input.lineOfBusiness,
        businessType: input.businessType,
        vendorCount: vendors.length
      }, { log: console.log });
      console.log(`[Activity] ✅ HTTP fallback sent to Pipeline Service`);
    } catch (fallbackError) {
      console.warn(`[Activity] HTTP fallback failed:`, fallbackError);
      // Don't fail if fallback fails - Event Grid already published
    }

    return { success: true, vendorCount: vendors.length };
  } catch (error: any) {
    console.error(`[Activity] Failed to publish plans.fetch_started:`, error);
    throw error;
  }
});

// =============================================================================
// Activity 2: Trigger RPA to fetch plans
// =============================================================================
const triggerRPA = df.activity(async (input: {
  leadId: string;
  lineOfBusiness: string;
  businessType: string;
  leadData: any;
}) => {
  console.log(`[Activity] Triggering RPA for lead ${input.leadId}`);

  try {
    const result = await rpaService.triggerRPA({
      leadId: input.leadId,
      lineOfBusiness: input.lineOfBusiness,
      businessType: input.businessType,
      lobData: input.leadData,
      ...input.leadData
    });

    console.log(`[Activity] RPA trigger result:`, result);

    return {
      success: result.success,
      vendorsTriggered: result.vendorsTriggered,
      vendorsFailed: result.vendorsFailed,
      error: result.error
    };
  } catch (error: any) {
    console.error(`[Activity] RPA trigger failed:`, error);
    // Don't throw - allow orchestrator to continue and check DB
    return {
      success: false,
      vendorsTriggered: [],
      vendorsFailed: [],
      error: error.message
    };
  }
});

// =============================================================================
// Activity 3: Fetch plans from database
// =============================================================================
const fetchPlansFromDB = df.activity(async (input: {
  leadId: string;
  lineOfBusiness: string;
}) => {
  console.log(`[Activity] Fetching plans from DB for lead ${input.leadId}`);

  try {
    // Fetch plans from Cosmos DB
    const plans = await cosmosService.getPlansForLead(input.leadId);

    console.log(`[Activity] Found ${plans.length} plans in database`);

    // Get successful and failed vendors
    const successfulVendors = Array.from(new Set(plans.map(p => p.vendorId)));
    const failedVendors: string[] = []; // TODO: Track failed vendors

    return {
      success: true,
      planCount: plans.length,
      plans: plans,
      successfulVendors,
      failedVendors
    };
  } catch (error: any) {
    console.error(`[Activity] Failed to fetch plans from DB:`, error);
    // Return empty result instead of throwing
    return {
      success: false,
      planCount: 0,
      plans: [],
      successfulVendors: [],
      failedVendors: []
    };
  }
});

// =============================================================================
// Activity 4: Publish plans.fetch_completed event
// =============================================================================
const publishPlansFetchCompleted = df.activity(async (input: {
  leadId: string;
  lineOfBusiness: string;
  businessType: string;
  planCount: number;
  plans: any[];
  successfulVendors: string[];
  failedVendors: string[];
  timedOut: boolean;
}) => {
  console.log(`[Activity] Publishing plans.fetch_completed for lead ${input.leadId}`);
  console.log(`[Activity] Plan count: ${input.planCount}, Timed out: ${input.timedOut}`);

  try {
    // Publish to Event Grid
    await eventGridService.publishPlansFetchCompleted({
      leadId: input.leadId,
      fetchRequestId: `fetch-${input.leadId}-${Date.now()}`,
      totalPlans: input.planCount,
      successfulVendors: input.successfulVendors,
      failedVendors: input.failedVendors,
      plans: input.plans
    });

    console.log(`[Activity] ✅ plans.fetch_completed event published`);

    // HTTP Fallback to Pipeline Service
    try {
      await notifyPipelineService('plans.fetch_completed', {
        leadId: input.leadId,
        lineOfBusiness: input.lineOfBusiness,
        businessType: input.businessType,
        totalPlans: input.planCount,
        successfulVendors: input.successfulVendors,
        failedVendors: input.failedVendors
      }, { log: console.log });
      console.log(`[Activity] ✅ HTTP fallback sent to Pipeline Service`);
    } catch (fallbackError) {
      console.warn(`[Activity] HTTP fallback failed:`, fallbackError);
    }

    return { success: true, planCount: input.planCount };
  } catch (error: any) {
    console.error(`[Activity] Failed to publish plans.fetch_completed:`, error);
    throw error;
  }
});

// =============================================================================
// Activity 5: Publish plans.fetch_failed event
// =============================================================================
const publishPlansFetchFailed = df.activity(async (input: {
  leadId: string;
  lineOfBusiness: string;
  error: string;
}) => {
  console.log(`[Activity] Publishing plans.fetch_failed for lead ${input.leadId}`);

  try {
    await eventGridService.publishPlansFetchFailed({
      leadId: input.leadId,
      fetchRequestId: `fetch-${input.leadId}-${Date.now()}`,
      error: input.error
    });

    console.log(`[Activity] ✅ plans.fetch_failed event published`);

    return { success: true };
  } catch (error: any) {
    console.error(`[Activity] Failed to publish plans.fetch_failed:`, error);
    // Don't throw - best effort
    return { success: false, error: error.message };
  }
});

// =============================================================================
// Register all activities
// =============================================================================
df.app.activity('publishPlansFetchStarted', publishPlansFetchStarted);
df.app.activity('triggerRPA', triggerRPA);
df.app.activity('fetchPlansFromDB', fetchPlansFromDB);
df.app.activity('publishPlansFetchCompleted', publishPlansFetchCompleted);
df.app.activity('publishPlansFetchFailed', publishPlansFetchFailed);

export {
  publishPlansFetchStarted,
  triggerRPA,
  fetchPlansFromDB,
  publishPlansFetchCompleted,
  publishPlansFetchFailed
};











