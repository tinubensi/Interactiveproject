/**
 * Pipeline Orchestrator
 * Core orchestration logic for pipeline execution
 */

import type {
  PipelineDefinition,
  PipelineInstance,
  PipelineStep,
  StageStep,
  ApprovalStep,
  DecisionStep,
  NotificationStep,
  WaitStep,
  StepType,
  LineOfBusiness,
  EnhancedStageStep,
  SyncActionConfig,
  AsyncActionConfig,
  StepHistoryEntry,
} from '../models/pipeline';

import {
  getActivePipelineForLOB,
  getPipeline,
} from '../repositories/pipelineRepository';

import {
  createInstance,
  getInstance,
  getInstanceByLeadId,
  moveToStep,
  setWaitingForEvent,
  setWaitingForApproval,
  updateInstanceStatus,
  updateInstanceStatusDirect,
  updateNextStepInfo,
  recordError,
} from '../repositories/instanceRepository';

import {
  createApproval,
  getApprovalByInstanceId,
  submitDecision,
} from '../repositories/approvalRepository';

import {
  getLead,
  updateLeadStage,
  UpdateLeadStageResult,
  evaluateLeadCondition,
  getLeadSummary,
} from '../services/leadServiceClient';

import {
  publishPipelineInstanceCreated,
  publishPipelineInstanceStepChanged,
  publishPipelineInstanceCompleted,
  publishApprovalRequired,
  publishApprovalDecided,
  publishPipelineNotificationRequired,
} from '../services/eventGridService';

import { publishActionEvent } from '../services/actionEventService';
import { httpRequest, getServiceUrl } from '../services/httpClient';
import { scheduleDelayedAction } from './queueHelper';
import { trackPipelineEvent, trackPipelineMetric } from './telemetry';
import { leadServiceBreaker } from './circuitBreaker';
import { v4 as uuidv4 } from 'uuid';

import {
  getStageById,
  getStageByTriggerEvent,
  getWaitEventById,
  getNotificationById,
  EVENT_TO_STAGE_MAP,
} from '../constants/predefined';

// =============================================================================
// Stage Mapping Constants
// =============================================================================

/**
 * Map Pipeline Service stage names to Lead Service stage IDs
 * This ensures correct stage IDs are sent to Lead Service API
 */
const STAGE_NAME_TO_LEAD_SERVICE_ID: Record<string, string> = {
  'Lead Created': 'stage-0', // Initial stage - use stage-0 to avoid conflict
  'Plans Fetching': 'stage-1',
  'Plans Fetch Failed': 'stage-1-failed',
  'Plans Available': 'stage-2',
  'Quotation Created': 'stage-3',
  'Quotation Sent': 'stage-4',
  'Revision Requested': 'stage-9',
  'Pending Review': 'stage-5',
  'Policy Issued': 'stage-6',
  'Rejected': 'stage-7',
  'Lost': 'stage-8',
  // Note: 'Approved', 'Policy Requested', 'Cancelled'
  // don't have direct mappings in Lead Service
};

// =============================================================================
// Types
// =============================================================================

export interface ProcessEventResult {
  processed: boolean;
  instanceId?: string;
  action?: string;
  error?: string;
}

export interface EventData {
  leadId: string;
  lineOfBusiness?: LineOfBusiness;
  businessType?: string;
  [key: string]: unknown;
}

// =============================================================================
// Main Event Processing
// =============================================================================

/**
 * Process an incoming event
 */
export async function processEvent(
  eventType: string,
  eventData: EventData,
  context?: { log: (...args: unknown[]) => void },
  requestId?: string
): Promise<ProcessEventResult> {
  const log = context?.log || console.log;

  const leadId = eventData.leadId;
  if (!leadId) {
    log(`Event ${eventType} has no leadId - skipping`);
    return { processed: false, error: 'No leadId in event' };
  }

  log(`Processing event ${eventType} for lead ${leadId}${requestId ? ` (requestId: ${requestId})` : ''}`);

  try {
    // Special case: lead.created - start a new pipeline instance
    if (eventType === 'lead.created') {
      return await handleLeadCreated(eventData, log);
    }

    // Check if this is a service completion event
    if (eventType.startsWith('service.')) {
      return await handleServiceCompletion(eventType, eventData, log, requestId);
    }

    // Handle refetch plans action
    if (eventType === 'pipeline.action.refetch_plans') {
      return await handleRefetchPlans(eventData, log);
    }

    // For all other events, find the active instance for this lead
    let instance = await getInstanceByLeadId(leadId);
    if (!instance) {
      log(`[EVENT PROCESSING] ✗ No active pipeline instance for lead ${leadId}`);
      log(`[EVENT PROCESSING] Event ${eventType} cannot be processed without an active instance`);
      return { processed: false, error: 'No active pipeline instance' };
    }

    log(`[EVENT PROCESSING] Found instance ${instance.instanceId} for lead ${leadId}`);
    log(`[EVENT PROCESSING] Instance status: ${instance.status}, current step: ${instance.currentStepId} (${instance.currentStepType})`);
    log(`[EVENT PROCESSING] Instance waiting for: ${instance.waitingForEvent || 'NONE'}`);
    log(`[EVENT PROCESSING] Instance current stage: ${instance.currentStageName || 'NONE'}`);

    // CRITICAL: Refresh instance to ensure we have the latest state
    // This handles cases where the instance was just updated
    // Retry up to 3 times with delays to handle Cosmos DB consistency
    // Optimized: Retry only once with a short delay if needed
    // This balances consistency checks with performance
    let refreshed = false;
    for (let attempt = 1; attempt <= 1; attempt++) {
      try {
        const refreshedInstance = await getInstanceByLeadId(leadId);
        if (refreshedInstance && refreshedInstance.instanceId === instance.instanceId) {
          instance = refreshedInstance;
          refreshed = true;
          log(`[EVENT PROCESSING] ✓ Refreshed instance ${instance.instanceId}`);
          break;
        }
      } catch (refreshError) {
        log(`[EVENT PROCESSING] ⚠ Refresh attempt failed: ${refreshError}`);
      }
    }

    if (!refreshed) {
      log(`[EVENT PROCESSING] ⚠ Warning: Could not refresh instance, using existing state`);
    }

    // Check if this event is relevant to the current pipeline state
    const pipeline = await getPipeline(instance.pipelineId);
    const currentStep = pipeline.steps.find(s => s.id === instance.currentStepId);

    if (!currentStep) {
      log(`Current step ${instance.currentStepId} not found in pipeline`);
      return { processed: false, error: 'Current step not found' };
    }

    // Handle based on current step type and event
    const result = await handleEventForStep(
      instance,
      pipeline,
      currentStep,
      eventType,
      eventData,
      log
    );

    return result;
  } catch (error) {
    log(`Error processing event: ${error}`);
    return { processed: false, error: String(error) };
  }
}

// =============================================================================
// Event Handlers
// =============================================================================

/**
 * Handle lead.created event - start a new pipeline
 */
async function handleLeadCreated(
  eventData: EventData,
  log: (...args: unknown[]) => void
): Promise<ProcessEventResult> {
  const { leadId, lineOfBusiness, businessType } = eventData;

  log(`[LEAD CREATED] Processing lead.created event for lead ${leadId}`);
  log(`[LEAD CREATED] Line of Business: ${lineOfBusiness}, Business Type: ${businessType || 'not specified'}`);

  if (!lineOfBusiness) {
    log(`[LEAD CREATED] ✗ Error: lead.created event missing lineOfBusiness`);
    return { processed: false, error: 'Missing lineOfBusiness' };
  }

  // Find the active pipeline for this LOB first (before checking for instance)
  log(`[LEAD CREATED] Looking for active pipeline for ${lineOfBusiness}/${businessType || 'individual'}`);
  const pipeline = await getActivePipelineForLOB(lineOfBusiness, businessType);
  if (!pipeline) {
    log(`[LEAD CREATED] ✗ No active pipeline found for ${lineOfBusiness}/${businessType}`);
    return { processed: false, error: 'No active pipeline for LOB' };
  }
  log(`[LEAD CREATED] ✓ Found pipeline: ${pipeline.name} (${pipeline.pipelineId})`);

  // CRITICAL FIX: Check if this is a refetch operation
  // Refetch events should trigger plan fetch even if instance already exists
  const isRefetch = (eventData as any).isRefetch === true || (eventData as any).data?.isRefetch === true;
  const refetchReason = (eventData as any).refetchReason || (eventData as any).data?.refetchReason;
  
  if (isRefetch) {
    log(`[LEAD CREATED] 🔄 REFETCH DETECTED for lead ${leadId}${refetchReason ? ` - Reason: ${refetchReason}` : ''}`);
  }

  // ATOMIC IDEMPOTENCY: Check and create in a try-catch to handle race conditions
  // This prevents duplicate pipelines when multiple events arrive simultaneously
  let instance: any;
  let isNewInstance = false;
  
  try {
    // First, check if instance already exists
    const existingInstance = await getInstanceByLeadId(leadId);
    if (existingInstance) {
      if (isRefetch) {
        // This is a refetch - reset instance to Plans Refetching step and trigger plan fetch
        log(`[LEAD CREATED] 🔄 Refetch detected - resetting instance ${existingInstance.instanceId} to Plans Refetching step`);
        
        // Find the "Plans Refetching" step in the pipeline (fallback to "Plans Fetching" if not found)
        let plansRefetchingStep = pipeline.steps.find(s => {
          if (s.type === 'stage') {
            const stageStep = s as StageStep;
            return stageStep.stageName === 'Plans Refetching';
          }
          return false;
        });
        
        // Fallback to Plans Fetching if Plans Refetching step doesn't exist
        if (!plansRefetchingStep) {
          log(`[LEAD CREATED] ⚠ Plans Refetching step not found, falling back to Plans Fetching`);
          plansRefetchingStep = pipeline.steps.find(s => {
            if (s.type === 'stage') {
              const stageStep = s as StageStep;
              return stageStep.stageName === 'Plans Fetching';
            }
            return false;
          });
        }
        
        const plansFetchingStep = plansRefetchingStep;
        
        if (plansFetchingStep) {
          const stepName = (plansFetchingStep as StageStep).stageName;
          log(`[LEAD CREATED] Moving instance to ${stepName} step: ${plansFetchingStep.id}`);
          await moveToStep(existingInstance.instanceId, plansFetchingStep, 'refetch_plans');
          
          // Refresh instance after move
          instance = await getInstanceByLeadId(leadId);
          if (instance) {
            log(`[LEAD CREATED] ✓ Instance reset to ${stepName} step`);
            log(`[LEAD CREATED] Current step: ${instance.currentStepId}, Stage: ${instance.currentStageName || 'NONE'}`);
            
            // Execute the step to set waiting state
            await executeStep(instance, pipeline, plansFetchingStep, 'lead.created', log);
            log(`[LEAD CREATED] ✓ ${stepName} step executed, instance ready for plans.fetch_started event`);
          } else {
            log(`[LEAD CREATED] ⚠ Warning: Could not refresh instance after reset`);
            instance = existingInstance;
          }
        } else {
          log(`[LEAD CREATED] ⚠ Warning: Plans Refetching/Fetching step not found in pipeline - using existing instance`);
          instance = existingInstance;
        }
        
        // Continue to trigger plan fetch below (don't return early)
        isNewInstance = false;
      } else {
        // Normal duplicate event - skip
        log(`[LEAD CREATED] ⚠ Lead ${leadId} already has active pipeline instance: ${existingInstance.instanceId}`);
        instance = existingInstance;
        isNewInstance = false;
      }
    } else {
      // No existing instance, try to create
      log(`[LEAD CREATED] Creating pipeline instance for lead ${leadId}...`);
      instance = await createInstance(pipeline, leadId, 'lead.created');
      log(`[LEAD CREATED] ✓ Created pipeline instance ${instance.instanceId} for lead ${leadId}`);
      log(`[LEAD CREATED] Initial step: ${instance.currentStepId} (${instance.currentStepType})`);
      isNewInstance = true;
    }
  } catch (error: any) {
    // Handle race condition: another event created the instance between our check and create
    if (error.code === 409 || error.message?.includes('conflict')) {
      log(`[LEAD CREATED] ⚠ Conflict detected - another process created instance. Fetching existing...`);
      const existingInstance = await getInstanceByLeadId(leadId);
      if (existingInstance) {
        instance = existingInstance;
        isNewInstance = false;
        
        // If this is a refetch, still need to reset and trigger fetch
        if (isRefetch) {
          log(`[LEAD CREATED] 🔄 Refetch detected after conflict - resetting instance`);
          
          // Find Plans Refetching step (fallback to Plans Fetching)
          let plansRefetchingStep = pipeline.steps.find(s => {
            if (s.type === 'stage') {
              const stageStep = s as StageStep;
              return stageStep.stageName === 'Plans Refetching';
            }
            return false;
          });
          
          if (!plansRefetchingStep) {
            plansRefetchingStep = pipeline.steps.find(s => {
              if (s.type === 'stage') {
                const stageStep = s as StageStep;
                return stageStep.stageName === 'Plans Fetching';
              }
              return false;
            });
          }
          
          if (plansRefetchingStep) {
            await moveToStep(instance.instanceId, plansRefetchingStep, 'refetch_plans');
            instance = await getInstanceByLeadId(leadId) || instance;
            await executeStep(instance, pipeline, plansRefetchingStep, 'lead.created', log);
          }
        }
      } else {
        throw new Error('Failed to retrieve instance after conflict');
      }
    } else {
      throw error; // Re-throw unexpected errors
    }
  }
  
  // Skip event publishing ONLY if this is a duplicate event AND NOT a refetch
  if (!isNewInstance && !isRefetch) {
    log(`[LEAD CREATED] ⚠ This is a duplicate event - skipping event publishing`);
    return { processed: true, instanceId: instance.instanceId };
  }
  
  // For refetch operations, skip instance creation event publishing but still trigger plan fetch
  if (isRefetch && !isNewInstance) {
    log(`[LEAD CREATED] 🔄 Refetch operation - skipping instance creation event (instance already exists)`);
    log(`[LEAD CREATED] ✓ Instance ${instance.instanceId} is ready to receive events`);
    // Skip to plan fetch trigger below - step execution already done during reset
  } else {
    // Only track and publish instance creation events for new instances
    trackPipelineEvent('PipelineInstanceCreated', {
      instanceId: instance.instanceId,
      pipelineId: pipeline.pipelineId,
      leadId,
      lineOfBusiness: lineOfBusiness || 'unknown',
      initialStep: instance.currentStepId,
    });

    // Publish instance created event
    await publishPipelineInstanceCreated({
      instanceId: instance.instanceId,
      pipelineId: pipeline.pipelineId,
      leadId,
      lineOfBusiness,
    });
    log(`[LEAD CREATED] ✓ Published pipeline.instance.created event`);

    log(`[LEAD CREATED] ✓ Instance is ready to receive events`);

    // Execute the entry step (Lead Created) to update lead status and set waiting state
    // This will set the instance to wait for plans.fetch_started event
    const entryStep = pipeline.steps.find(s => s.id === instance.currentStepId);
    if (entryStep) {
      log(`[LEAD CREATED] Executing entry step: ${entryStep.id} (${entryStep.type})`);
      await executeStep(instance, pipeline, entryStep, 'lead.created', log);
      log(`[LEAD CREATED] ✓ Entry step executed, instance ready to receive events`);
    } else {
      log(`[LEAD CREATED] ⚠ WARNING: Entry step not found for instance.currentStepId: ${instance.currentStepId}`);
    }
  }

  // THEN trigger plan fetching (so events arrive after instance is ready)
  // This ensures plans.fetch_started and plans.fetch_completed events are processed correctly
  const quotationGenServiceUrl = getServiceUrl('quotation-gen');

  try {
    const fetchUrl = `${quotationGenServiceUrl}/api/plans/fetch`;

    log(`[LEAD CREATED] Triggering plan fetch for lead ${leadId}`);
    log(`[LEAD CREATED] Quotation service URL: ${fetchUrl}`);

    // Get complete lead data from Lead Service for plan fetching
    let leadData = eventData.lobData || {};
    try {
      log(`[LEAD CREATED] Fetching complete lead data from Lead Service...`);
      const completeLead = await getLead(leadId, lineOfBusiness);
      if (completeLead) {
        // Merge complete lead data with any existing lobData
        leadData = {
          ...completeLead.lobData,
          ...leadData,
          // Include key lead fields that quotation service needs
          dateOfBirth: completeLead.lobData?.dateOfBirth,
          gender: completeLead.lobData?.gender,
          estimatedPremium: completeLead.lobData?.estimatedPremium,
          coverageAmount: completeLead.lobData?.coverageAmount,
        };
        log(`[LEAD CREATED] ✓ Retrieved complete lead data for plan fetching`);
      } else {
        log(`[LEAD CREATED] ⚠ Warning: Could not retrieve complete lead data for ${leadId}`);
      }
    } catch (leadError) {
      log(`[LEAD CREATED] ⚠ Warning: Failed to fetch complete lead data: ${leadError}`);
      // Continue with partial data
    }

    // Include internal service key if configured
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.INTERNAL_SERVICE_KEY) {
      headers['x-service-key'] = process.env.INTERNAL_SERVICE_KEY;
      log(`[LEAD CREATED] Using service key for authentication`);
    }

    log(`[LEAD CREATED] Calling quotation service to fetch plans...`);
    const fetchResponse = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        leadId,
        lineOfBusiness,
        businessType: businessType || 'individual',
        leadData,
        forceRefresh: true, // ensure fresh fetch
      }),
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (fetchResponse.ok) {
      const result = (await fetchResponse.json()) as { message?: string };
      log(`[LEAD CREATED] ✓ Plan fetch triggered successfully: ${result.message || 'OK'}`);
      log(`[LEAD CREATED] Expected event flow:`);
      log(`[LEAD CREATED]   1. plans.fetch_started → advance to "Plans Fetching"`);
      log(`[LEAD CREATED]   2. plans.fetch_completed → advance to "Plans Available"`);
      log(`[LEAD CREATED] Instance ${instance.instanceId} is ready to process these events`);

      // CRITICAL FIX: Verify instance state is correct before events arrive
      // The quotation service will publish events and call pipeline service via HTTP fallback
      // This ensures the instance is ready to receive and process those events
      try {
        // Wait a moment for instance state to be fully committed
        await new Promise(resolve => setTimeout(resolve, 1000));

        const refreshedInstance = await getInstanceByLeadId(leadId);
        if (refreshedInstance) {
          instance = refreshedInstance;
          log(`[LEAD CREATED] ✓ Verified instance state after plan fetch trigger:`);
          log(`[LEAD CREATED]   - Current stage: ${instance.currentStageName || 'NONE'}`);
          log(`[LEAD CREATED]   - Waiting for event: ${instance.waitingForEvent || 'NONE'}`);
          log(`[LEAD CREATED]   - Progress: ${instance.progressPercent}%`);
          log(`[LEAD CREATED]   - Status: ${instance.status}`);

          // Verify the instance is in the correct state to receive events
          if (instance.waitingForEvent === 'plans.fetch_started') {
            log(`[LEAD CREATED] ✓ Instance is correctly waiting for plans.fetch_started event`);
            log(`[LEAD CREATED] ✓ Quotation service will publish this event and call pipeline service via HTTP fallback`);
            log(`[LEAD CREATED] ✓ The event will be processed automatically when it arrives`);
          } else {
            log(`[LEAD CREATED] ⚠ WARNING: Instance waitingForEvent is "${instance.waitingForEvent}" but expected "plans.fetch_started"`);
            log(`[LEAD CREATED] ⚠ This may prevent automatic progression - check instance state`);
          }
        } else {
          log(`[LEAD CREATED] ⚠ WARNING: Could not refresh instance to verify state`);
        }
      } catch (verifyError) {
        log(`[LEAD CREATED] ⚠ Warning: Could not verify instance state: ${verifyError}`);
        log(`[LEAD CREATED] Events will still be processed when they arrive via Event Grid or HTTP fallback`);
      }
    } else {
      const errorText = await fetchResponse.text();
      log(`[LEAD CREATED] ✗ Plan fetch failed: ${fetchResponse.status} - ${errorText}`);

      // Log additional context for debugging
      if (fetchResponse.status === 400) {
        log(`[LEAD CREATED] Bad request - likely missing required lead data fields`);
        log(`[LEAD CREATED] Lead data keys: ${Object.keys(leadData).join(', ')}`);
      } else if (fetchResponse.status === 500) {
        log(`[LEAD CREATED] Server error - quotation generation service may be down`);
      } else if (fetchResponse.status === 403) {
        log(`[LEAD CREATED] Authentication error - check service key`);
      }

      // Don't force pipeline advance on failure - let Event Grid handle it
      log(`[LEAD CREATED] Skipping pipeline advance - relying on Event Grid for retry`);
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      log(`[LEAD CREATED] ✗ Plan fetch request timed out after 30 seconds`);
    } else if (error.code === 'ECONNREFUSED') {
      log(`[LEAD CREATED] ✗ Connection refused - quotation generation service may not be running`);
    } else if (error.code === 'ENOTFOUND') {
      log(`[LEAD CREATED] ✗ DNS resolution failed - check service URL: ${quotationGenServiceUrl}`);
    } else {
      log(`[LEAD CREATED] ✗ Error triggering plan fetch: ${error?.message || String(error)}`);
    }

    // Log stack trace for debugging if available
    if (error.stack) {
      log(`[LEAD CREATED] Stack trace: ${error.stack}`);
    }

    // Don't throw - this is a fallback, Event Grid might still deliver the event
    log(`[LEAD CREATED] Continuing - Event Grid should handle plan fetching via events`);
  }

  log(`[LEAD CREATED] ✓ Pipeline started successfully for lead ${leadId}`);
  return {
    processed: true,
    instanceId: instance.instanceId,
    action: 'pipeline_started',
  };
}

/**
 * Handle refetch plans action - retry fetching plans after failure
 */
async function handleRefetchPlans(
  eventData: EventData,
  log: (...args: unknown[]) => void
): Promise<ProcessEventResult> {
  const { leadId, lineOfBusiness } = eventData;

  log(`[REFETCH_PLANS] Processing refetch plans action for lead ${leadId}`);

  if (!leadId || !lineOfBusiness) {
    log(`[REFETCH_PLANS] ✗ Missing leadId or lineOfBusiness`);
    return { processed: false, error: 'Missing required fields' };
  }

  // Get the pipeline instance
  const instance = await getInstanceByLeadId(leadId);
  if (!instance) {
    log(`[REFETCH_PLANS] ✗ No active pipeline instance found for lead ${leadId}`);
    return { processed: false, error: 'No active pipeline instance' };
  }

  log(`[REFETCH_PLANS] Found instance ${instance.instanceId} at stage "${instance.currentStageName}"`);

  // Get the pipeline to find Plans Fetching stage
  const pipeline = await getPipeline(instance.pipelineId);
  const plansFetchingStep = pipeline.steps.find(
    s => s.type === 'stage' && (s as StageStep).stageName === 'Plans Fetching'
  ) as StageStep | undefined;

  if (!plansFetchingStep) {
    log(`[REFETCH_PLANS] ✗ Plans Fetching stage not found in pipeline`);
    return { processed: false, error: 'Plans Fetching stage not found' };
  }

  // Move instance to Plans Fetching stage
  log(`[REFETCH_PLANS] Moving instance to Plans Fetching stage`);
  await moveToStep(instance.instanceId, plansFetchingStep, 'refetch_plans');
  
  // Update lead stage to Plans Fetching
  const freshInstance = await getInstance(instance.instanceId);
  await executeStageStep(freshInstance, plansFetchingStep, log);

  // Trigger quotation service to refetch plans
  const quotationGenServiceUrl = getServiceUrl('quotation-gen');
  const fetchUrl = `${quotationGenServiceUrl}/api/plans/fetch`;

  log(`[REFETCH_PLANS] Triggering plan fetch for lead ${leadId}`);
  log(`[REFETCH_PLANS] Quotation service URL: ${fetchUrl}`);

  try {
    // Get complete lead data
    let leadData = {};
    const completeLead = await getLead(leadId, lineOfBusiness);
    if (completeLead) {
      leadData = {
        ...completeLead.lobData,
        dateOfBirth: completeLead.lobData?.dateOfBirth,
        gender: completeLead.lobData?.gender,
        estimatedPremium: completeLead.lobData?.estimatedPremium,
        coverageAmount: completeLead.lobData?.coverageAmount,
      };
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (process.env.INTERNAL_SERVICE_KEY) {
      headers['x-service-key'] = process.env.INTERNAL_SERVICE_KEY;
    }

    const fetchResponse = await fetch(fetchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        leadId,
        lineOfBusiness,
        businessType: instance.businessType || 'individual',
        leadData,
        forceRefresh: true,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (fetchResponse.ok) {
      log(`[REFETCH_PLANS] ✓ Plan refetch triggered successfully`);
      return {
        processed: true,
        action: 'refetch_triggered',
      };
    } else {
      const errorText = await fetchResponse.text();
      log(`[REFETCH_PLANS] ✗ Plan refetch failed: ${fetchResponse.status} - ${errorText}`);
      return {
        processed: false,
        error: `Refetch failed: ${fetchResponse.status}`,
      };
    }
  } catch (error: any) {
    log(`[REFETCH_PLANS] ✗ Error triggering refetch: ${error.message}`);
    return {
      processed: false,
      error: error.message,
    };
  }
}

/**
 * Handle an event for a specific step
 */
async function handleEventForStep(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  currentStep: PipelineStep,
  eventType: string,
  eventData: EventData,
  log: (...args: unknown[]) => void
): Promise<ProcessEventResult> {
  // Check if this event matches what the current step is waiting for
  let shouldAdvance = false;
  let outcome: 'completed' | 'approved' | 'rejected' | undefined;

  log(`[EVENT MATCHING] ========================================`);
  log(`[EVENT MATCHING] Instance ${instance.instanceId} at step ${currentStep.id} (${currentStep.type})`);
  log(`[EVENT MATCHING] Current stage: ${instance.currentStageName || 'NONE'} (${instance.currentStageId || 'NONE'})`);
  log(`[EVENT MATCHING] Waiting for event: ${instance.waitingForEvent || 'NONE'}`);
  log(`[EVENT MATCHING] Received event: ${eventType}`);
  log(`[EVENT MATCHING] Instance status: ${instance.status}`);
  log(`[EVENT MATCHING] Instance progress: ${instance.progressPercent}%`);

  // Handle error events - plans.fetch_failed
  if (eventType === 'plans.fetch_failed') {
    log(`[ERROR EVENT] Received plans.fetch_failed for lead ${instance.leadId}`);
    
    // Find "Plans Fetch Failed" stage
    const failedStageStep = pipeline.steps.find(
      s => s.type === 'stage' && (s as StageStep).stageName === 'Plans Fetch Failed'
    ) as StageStep | undefined;
    
    if (failedStageStep) {
      log(`[ERROR EVENT] Moving to Plans Fetch Failed stage`);
      await moveToStep(instance.instanceId, failedStageStep, 'plans.fetch_failed');
      
      // Execute the failed stage step to update lead stage
      const freshInstance = await getInstance(instance.instanceId);
      await executeStageStep(freshInstance, failedStageStep, log);
      
      return { processed: true, action: 'moved_to_failed_stage' };
    } else {
      log(`[ERROR EVENT] No Plans Fetch Failed stage defined in pipeline`);
      return { processed: false, error: 'No error stage defined' };
    }
  }

  switch (currentStep.type) {
    case 'stage':
      // CRITICAL FIX: Stage steps advance when:
      // 1. The instance is explicitly waiting for this event (instance.waitingForEvent), OR
      // 2. The event matches the trigger event for the NEXT stage

      log(`[STAGE] Checking if event matches waiting state or next stage trigger...`);

      // First, check if instance is explicitly waiting for this event
      if (instance.waitingForEvent && instance.waitingForEvent === eventType) {
        shouldAdvance = true;
        log(`[STAGE] ✓ MATCH: Event ${eventType} matches instance.waitingForEvent="${instance.waitingForEvent}" - WILL ADVANCE`);
      } else {
        log(`[STAGE] Event ${eventType} does NOT match instance.waitingForEvent="${instance.waitingForEvent || 'NONE'}"`);

        // CRITICAL FIX: Plans Refetching should go directly to Plans Available
        // BUT only if we actually have plans! Otherwise go to Plans Fetch Failed
        const stageStep = currentStep as StageStep;
        if (stageStep.stageName === 'Plans Refetching' && eventType === 'plans.fetch_completed') {
          const totalPlans = (eventData as any).totalPlans || 0;
          log(`[STAGE] ✅ SPECIAL CASE: Plans Refetching + plans.fetch_completed with ${totalPlans} plans`);
          
          if (totalPlans > 0) {
            log(`[STAGE] ✓ Has plans → will advance to Plans Available`);
            shouldAdvance = true;
          } else {
            log(`[STAGE] ✗ 0 plans → will advance to Plans Fetch Failed`);
            // Find Plans Fetch Failed stage
            const failedStageStep = pipeline.steps.find(
              s => s.type === 'stage' && (s as StageStep).stageName === 'Plans Fetch Failed'
            ) as StageStep | undefined;
            
            if (failedStageStep) {
              log(`[STAGE] Moving to Plans Fetch Failed stage`);
              await moveToStep(instance.instanceId, failedStageStep, 'plans.fetch_completed_zero_plans');
              const freshInstance = await getInstance(instance.instanceId);
              await executeStageStep(freshInstance, failedStageStep, log);
              return { processed: true, action: 'moved_to_failed_stage' };
            } else {
              log(`[STAGE] ⚠ Plans Fetch Failed stage not found - staying at current stage`);
              return { processed: false, error: 'Plans Fetch Failed stage not found' };
            }
          }
        } else {
          // Check if event matches next stage's trigger event
          // NOTE: We do NOT check if the event matches the current stage's trigger event,
          // because that's the event that got us TO this stage, not the event that should
          // advance us FROM this stage. Checking current stage trigger would cause incorrect
          // advancement (e.g., receiving plans.fetch_completed while at "Plans Available"
          // would incorrectly advance to "Quotation Created").
          const nextStep = getNextEnabledStep(pipeline.steps, currentStep.id);
          log(`[STAGE] Checking next step: ${nextStep ? `${nextStep.id} (${nextStep.type})` : 'none'}`);

          if (nextStep?.type === 'stage') {
            const nextStageStep = nextStep as StageStep;
            const expectedEvent = getStageById(nextStageStep.stageId)?.triggerEvent;
            log(`[STAGE] Next stage: ${nextStageStep.stageName} (${nextStageStep.stageId})`);
            log(`[STAGE] Next stage trigger event: ${expectedEvent || 'NONE'}`);
            shouldAdvance = eventType === expectedEvent;
            if (shouldAdvance) {
              log(`[STAGE] ✓ MATCH: Event ${eventType} matches next stage trigger ${expectedEvent} - WILL ADVANCE`);
            } else {
              log(`[STAGE] ✗ NO MATCH: Event ${eventType} does NOT match next stage trigger ${expectedEvent}`);
              log(`[STAGE] ✗ Instance is waiting for: ${instance.waitingForEvent || 'NONE'}`);
              log(`[STAGE] ✗ This event will be ignored - instance will remain at current stage`);
            }
          } else if (nextStep) {
            // Next step is not a stage - check if current stage is complete
            shouldAdvance = true;
            log(`[STAGE] Next step is not a stage (${nextStep.type}), auto-advancing`);
          } else {
            log(`[STAGE] No next step found after ${currentStep.id} - pipeline may be complete`);
          }
        }
      }
      outcome = 'completed';
      break;

    case 'wait':
      const waitStep = currentStep as WaitStep;
      const waitEvent = getWaitEventById(waitStep.waitForEvent);
      
      // For customer_response wait events, validate responseType
      if (waitStep.waitForEvent === 'customer_response' && eventType === 'customer.responded') {
        const responseType = eventData?.responseType as string;
        const selectedPlanId = eventData?.selectedPlanId;
        
        // Only advance if customer selected a plan (not just viewed)
        // Also allow request_revision and reject_plans to advance (they need to be handled by decision step)
        // Handle cases where selectedPlanId might be a string, number, UUID, or other type
        const selectedPlanIdStr = selectedPlanId ? String(selectedPlanId).trim() : '';
        const hasValidSelectedPlan = selectedPlanIdStr.length > 0;
        const hasPlanSelection: boolean = responseType === 'plan_selected' && hasValidSelectedPlan;
        const isRevisionRequest: boolean = responseType === 'request_revision';
        const isPlanRejection: boolean = responseType === 'reject_plans';
        
        shouldAdvance = hasPlanSelection || isRevisionRequest || isPlanRejection;
        log(`[WAIT] Customer response: responseType="${responseType}", selectedPlanId="${selectedPlanId}" (as string: "${selectedPlanIdStr}")`);
        log(`[WAIT] Plan selected: ${hasPlanSelection}, Revision request: ${isRevisionRequest}, Plan rejection: ${isPlanRejection}`);
        log(`[WAIT] Valid selected plan: ${hasValidSelectedPlan}, Should advance: ${shouldAdvance} - ${shouldAdvance ? 'ADVANCING' : 'WAITING'}`);
      } else {
        // For other wait events, use existing logic
        shouldAdvance = (instance.waitingForEvent && instance.waitingForEvent === eventType) ||
                        (eventType === waitEvent?.eventType);
      }
      
      log(`[WAIT] Event ${eventType} vs expected ${waitEvent?.eventType}: ${shouldAdvance ? 'MATCH - ADVANCING' : 'NO MATCH'}`);
      outcome = 'completed';
      break;

    case 'approval':
      // Approvals are handled via the approval.decided event
      if (eventType === 'pipeline.approval.decided') {
        const decision = eventData.decision as 'approved' | 'rejected';
        shouldAdvance = true;
        outcome = decision;
        log(`[APPROVAL] Received approval decision: ${decision} - ADVANCING`);

        // Handle rejection - might need to go to a different step
        if (decision === 'rejected') {
          // For now, just mark as completed and move to next step
          // In the future, could support a "rejectionStepId" property
        }
      }
      break;

    case 'decision':
    case 'notification':
      // These should be executed immediately after the previous step
      // They shouldn't be waiting for external events
      log(`[${currentStep.type.toUpperCase()}] These steps don't wait for events - should be auto-executed`);
      break;
  }

  if (!shouldAdvance) {
    log(`[EVENT MATCHING] Event ${eventType} does NOT advance current step ${currentStep.id} - NO ACTION`);
    return { processed: false, action: 'no_advancement' };
  }

  log(`[EVENT MATCHING] Event ${eventType} WILL advance current step ${currentStep.id} - PROCEEDING`);

  // CRITICAL FIX #2: Check for responseType routing (customer.responded events)
  // This handles configuration-driven pipelines without explicit decision steps
  let nextStep = getNextStepForOutcome(pipeline, currentStep, outcome);
  
  if (eventType === 'customer.responded' && eventData?.responseType) {
    const responseType = eventData.responseType as string;
    log(`[EVENT MATCHING] customer.responded event with responseType: ${responseType}`);
    
    // Route based on customer response type
    if (responseType === 'request_revision') {
      log(`[EVENT MATCHING] Customer requested revision - routing to Revision Requested stage`);
      const revisionStep = pipeline.steps.find(s => 
        s.type === 'stage' && (s as any).stageId === 'revision-requested'
      );
      if (revisionStep) {
        nextStep = revisionStep;
        log(`[EVENT MATCHING] ✓ Found Revision Requested stage: ${revisionStep.id}`);
      } else {
        log(`[EVENT MATCHING] ⚠ Warning: Revision Requested stage not found, using default next step`);
      }
    } else if (responseType === 'reject_plans') {
      log(`[EVENT MATCHING] Customer rejected plans - routing to Lost stage`);
      const lostStep = pipeline.steps.find(s => 
        s.type === 'stage' && (s as any).stageId === 'lost'
      );
      if (lostStep) {
        nextStep = lostStep;
        log(`[EVENT MATCHING] ✓ Found Lost stage: ${lostStep.id}`);
      } else {
        log(`[EVENT MATCHING] ⚠ Warning: Lost stage not found, using default next step`);
      }
    } else if (responseType === 'plan_selected') {
      log(`[EVENT MATCHING] Customer selected plan - routing to Pending Review stage`);
      const pendingReviewStep = pipeline.steps.find(s => 
        s.type === 'stage' && (s as any).stageId === 'pending-review'
      );
      if (pendingReviewStep) {
        nextStep = pendingReviewStep;
        log(`[EVENT MATCHING] ✓ Found Pending Review stage: ${pendingReviewStep.id}`);
      } else {
        log(`[EVENT MATCHING] ⚠ Warning: Pending Review stage not found, using default next step`);
      }
    }
  }

  // Advance to the next step
  if (nextStep) {
    log(`[EVENT MATCHING] Next step determined: ${nextStep.id} (${nextStep.type})`);
    if (nextStep.type === 'stage') {
      const nextStageStep = nextStep as StageStep;
      log(`[EVENT MATCHING] Next stage will be: ${nextStageStep.stageName}`);
    }

    // CRITICAL: Advance to the next step (this will update lead stage)
    await advanceToStep(instance, pipeline, currentStep, nextStep, eventType, outcome, log, eventData);

    // CRITICAL: Refresh instance to ensure we have the latest state
    // Reduced retry count to improve performance
    let finalInstance: PipelineInstance | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt)); // Wait for consistency
        const refreshedInstance = await getInstanceByLeadId(instance.leadId);
        if (refreshedInstance) {
          finalInstance = refreshedInstance;
          log(`[EVENT MATCHING] ✓ Refreshed instance after advancement (attempt ${attempt})`);
          log(`[EVENT MATCHING] Current stage: ${refreshedInstance.currentStageName || 'NONE'}`);
          log(`[EVENT MATCHING] Progress: ${refreshedInstance.progressPercent}%`);
          log(`[EVENT MATCHING] Waiting for: ${refreshedInstance.waitingForEvent || 'NONE'}`);

          // Verify lead stage was updated if we advanced to a stage step
          if (nextStep.type === 'stage' && refreshedInstance.currentStageName) {
            try {
              const lead = await getLead(instance.leadId, instance.lineOfBusiness);
              if (lead) {
                log(`[EVENT MATCHING] Lead stage verification: currentStage="${lead.currentStage}", stageId="${lead.stageId}"`);
                if (lead.currentStage !== refreshedInstance.currentStageName) {
                  log(`[EVENT MATCHING] ⚠ WARNING: Lead stage mismatch! Pipeline stage: "${refreshedInstance.currentStageName}", Lead Service stage: "${lead.currentStage}"`);
                  log(`[EVENT MATCHING] ⚠ This may indicate Lead Service update failed - check logs above`);
                } else {
                  log(`[EVENT MATCHING] ✓ Lead stage matches pipeline stage: "${lead.currentStage}"`);
                }
              }
            } catch (leadError) {
              log(`[EVENT MATCHING] ⚠ Could not verify lead stage: ${leadError}`);
            }
          }

          break; // Successfully refreshed
        }
      } catch (refreshError) {
        log(`[EVENT MATCHING] ⚠ Refresh attempt ${attempt} failed: ${refreshError}`);
        if (attempt === 5) {
          log(`[EVENT MATCHING] ⚠ WARNING: Could not refresh instance after 5 attempts`);
        }
      }
    }

    return {
      processed: true,
      instanceId: instance.instanceId,
      action: `advanced_to_${nextStep.id}`,
    };
  } else {
    // No next step - pipeline is complete
    log(`[COMPLETION] No next step found - completing pipeline`);
    await completeInstance(instance, 'completed', log);
    return {
      processed: true,
      instanceId: instance.instanceId,
      action: 'pipeline_completed',
    };
  }
}

// =============================================================================
// Timeout Handling
// =============================================================================

/**
 * Check if an instance has timed out while waiting for an event
 * Default timeout: 10 minutes for plan fetching, 30 minutes for other stages
 */
export function hasTimedOut(instance: PipelineInstance): boolean {
  if (!instance.waitingForEvent || instance.status !== 'active') {
    return false;
  }

  // If explicit waitingUntil is set, use that
  if (instance.waitingUntil) {
    return new Date(instance.waitingUntil) < new Date();
  }

  // Otherwise use action deadline if present
  if (instance.actionDeadline) {
    return new Date(instance.actionDeadline) < new Date();
  }

  // Fallback: check if waiting for plans.fetch_completed
  // Use 10 minutes timeout for plan fetching
  if (instance.waitingForEvent === 'plans.fetch_completed') {
    const timeoutMinutes = 10;
    const startTime = instance.actionStartedAt ? new Date(instance.actionStartedAt) : new Date(instance.updatedAt);
    const timeoutDate = new Date(startTime.getTime() + timeoutMinutes * 60 * 1000);
    return new Date() > timeoutDate;
  }

  // No timeout configured
  return false;
}

/**
 * Handle timeout by auto-advancing the instance to the next stage
 * Used when waiting for events that never arrive (e.g., RPA failures)
 */
export async function handleTimeout(
  instance: PipelineInstance,
  log: (...args: unknown[]) => void = console.log
): Promise<ProcessEventResult> {
  log(`[TIMEOUT] Handling timeout for instance ${instance.instanceId} waiting for ${instance.waitingForEvent}`);

  try {
    const pipeline = await getPipeline(instance.pipelineId);
    if (!pipeline) {
      log(`[TIMEOUT] Pipeline ${instance.pipelineId} not found`);
      return { processed: false, error: 'Pipeline not found' };
    }

    const currentStep = pipeline.steps.find(s => s.id === instance.currentStepId);
    if (!currentStep) {
      log(`[TIMEOUT] Current step ${instance.currentStepId} not found`);
      return { processed: false, error: 'Current step not found' };
    }

    // Get the next step
    const nextStep = getNextEnabledStep(pipeline.steps, currentStep.id);
    if (!nextStep) {
      log(`[TIMEOUT] No next step found - completing pipeline`);
      await completeInstance(instance, 'completed', log);
      return { processed: true, action: 'completed_on_timeout' };
    }

    log(`[TIMEOUT] Auto-advancing to next step: ${nextStep.id} (${nextStep.type})`);

    // Record timeout in history
    const historyEntry: StepHistoryEntry = {
      stepId: instance.currentStepId,
      stepType: instance.currentStepType,
      stageName: instance.currentStageName,
      stepName: currentStep.name || instance.currentStageName,
      enteredAt: instance.actionStartedAt || instance.updatedAt,
      exitedAt: new Date().toISOString(),
      outcome: 'timeout',
      triggeredBy: 'system-timeout',
      metadata: {
        waitingForEvent: instance.waitingForEvent,
        timeoutReason: `Timed out after 10 minutes waiting for ${instance.waitingForEvent}`,
      },
    };

    instance.stepHistory.push(historyEntry);

    // Clear waiting state
    instance.waitingForEvent = undefined;
    instance.waitingUntil = undefined;
    instance.actionDeadline = undefined;
    instance.actionStartedAt = undefined;

    // Advance to next step
    await moveToStep(instance.instanceId, nextStep, 'system-timeout', 'timeout', instance, instance.leadId);

    // If next step is a stage, execute it
    if (nextStep.type === 'stage') {
      const stageStep = nextStep as StageStep;
      const freshInstance = await getInstance(instance.instanceId);
      await executeStageStep(freshInstance, stageStep, log);
    }

    log(`[TIMEOUT] Successfully advanced instance ${instance.instanceId} to ${nextStep.id}`);
    
    // Publish warning notification
    try {
      await publishPipelineNotificationRequired({
        instanceId: instance.instanceId,
        leadId: instance.leadId,
        lineOfBusiness: instance.lineOfBusiness,
        notificationType: 'timeout_warning',
        channel: 'email',
        recipientType: 'manager',
        templateId: 'pipeline_timeout_warning',
        customMessage: `Pipeline timed out waiting for ${instance.waitingForEvent}. Auto-advanced to next stage.`,
        stageName: instance.currentStageName,
      });
    } catch (notifError) {
      log(`[TIMEOUT] Failed to publish timeout notification: ${notifError}`);
    }

    return {
      processed: true,
      instanceId: instance.instanceId,
      action: `timeout_advanced_to_${nextStep.id}`,
    };
  } catch (error) {
    log(`[TIMEOUT] Error handling timeout: ${error}`);
    return { processed: false, error: String(error) };
  }
}

/**
 * Check all active instances for timeouts and handle them
 * This can be called by a timer function or manually
 */
export async function checkAndHandleTimeouts(
  log: (...args: unknown[]) => void = console.log
): Promise<{ checked: number; timedOut: number; handled: number }> {
  log('[TIMEOUT CHECK] Checking for timed-out instances...');

  try {
    // Get all active instances waiting for events
    const { listInstances } = await import('../repositories/instanceRepository');
    const instances = await listInstances({ status: 'active' });

    const waitingInstances = instances.filter(i => i.waitingForEvent);
    log(`[TIMEOUT CHECK] Found ${waitingInstances.length} instances waiting for events`);

    let timedOutCount = 0;
    let handledCount = 0;

    for (const instance of waitingInstances) {
      if (hasTimedOut(instance)) {
        timedOutCount++;
        log(`[TIMEOUT CHECK] Instance ${instance.instanceId} has timed out`);

        const result = await handleTimeout(instance, log);
        if (result.processed) {
          handledCount++;
        }
      }
    }

    log(`[TIMEOUT CHECK] Checked ${waitingInstances.length} instances, found ${timedOutCount} timeouts, handled ${handledCount}`);

    return {
      checked: waitingInstances.length,
      timedOut: timedOutCount,
      handled: handledCount,
    };
  } catch (error) {
    log(`[TIMEOUT CHECK] Error: ${error}`);
    return { checked: 0, timedOut: 0, handled: 0 };
  }
}

// =============================================================================
// Step Execution
// =============================================================================

/**
 * Execute a step
 */
async function executeStep(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  step: PipelineStep,
  triggeredBy: string,
  log: (...args: unknown[]) => void,
  eventData?: EventData
): Promise<void> {
  log(`Executing step ${step.id} (${step.type}) for instance ${instance.instanceId}`);

  // Track step execution duration
  const startTime = Date.now();
  try {
    await executeStepInternal(instance, pipeline, step, triggeredBy, log, eventData);
  } finally {
    const duration = Date.now() - startTime;
    trackPipelineMetric('pipeline.step.duration', duration, {
      stepType: step.type,
      stepId: step.id,
      instanceId: instance.instanceId,
    });
  }
}

async function executeStepInternal(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  step: PipelineStep,
  triggeredBy: string,
  log: (...args: unknown[]) => void,
  eventData?: EventData
): Promise<void> {
  switch (step.type) {
    case 'stage':
      try {
        await executeStageStep(instance, step as StageStep, log, eventData);
        log(`Stage step ${step.id} executed successfully`);
      } catch (error) {
        log(`Error executing stage step ${step.id}: ${error}`);
        // Don't throw - continue to set waiting state even if stage step execution had issues
        // The stage update might have partially succeeded
      }
      break;

    case 'approval':
      await executeApprovalStep(instance, pipeline, step as ApprovalStep, log);
      return; // Don't auto-advance - wait for approval

    case 'decision':
      await executeDecisionStep(instance, pipeline, step as DecisionStep, triggeredBy, log, eventData);
      return; // Decision step handles its own advancement

    case 'notification':
      await executeNotificationStep(instance, step as NotificationStep, log);
      // Notification steps always auto-advance to the next step
      {
        const nextStep = getNextEnabledStep(pipeline.steps, step.id);
        if (nextStep) {
          const updatedInstance = await getInstance(instance.instanceId);
          await advanceToStep(updatedInstance, pipeline, step, nextStep, triggeredBy, 'completed', log, eventData);
        } else {
          // No more steps - pipeline complete
          await completeInstance(instance, 'completed', log);
        }
      }
      return;

    case 'wait':
      await executeWaitStep(instance, step as WaitStep, log);
      return; // Don't auto-advance - wait for event
  }

  // For stage steps, check if we should auto-advance to immediate steps (decision/notification)
  // or set waiting state for the next stage
  const nextStep = getNextEnabledStep(pipeline.steps, step.id);
  log(`[STAGE EXECUTION] Next step after ${step.id}: ${nextStep ? `${nextStep.id} (${nextStep.type})` : 'none'}`);

  if (nextStep && (nextStep.type === 'decision' || nextStep.type === 'notification')) {
    // Auto-execute immediate steps (decision/notification don't wait for events)
    log(`[STAGE EXECUTION] Auto-advancing to immediate step: ${nextStep.id} (${nextStep.type})`);
    // Get fresh instance for advancing
    try {
      const updatedInstance = await getInstance(instance.instanceId);
      await advanceToStep(updatedInstance, pipeline, step, nextStep, triggeredBy, 'completed', log, eventData);
    } catch (error) {
      log(`[STAGE EXECUTION] Warning: Failed to get instance for advance, using current: ${error}`);
      await advanceToStep(instance, pipeline, step, nextStep, triggeredBy, 'completed', log, eventData);
    }
  } else if (nextStep && nextStep.type === 'stage') {
    // CRITICAL FIX: Check if CURRENT stage has exitConditions (configuration-driven pipeline)
    const currentStageMetadata = (step as any).metadata;
    const nextStageStep = nextStep as StageStep;
    
    if (currentStageMetadata?.exitConditions && currentStageMetadata.exitConditions.length > 0) {
      // Configuration-driven pipeline: Use exitConditions from current stage
      const primaryExitEvent = currentStageMetadata.exitConditions[0];
      log(`[STAGE EXECUTION] Current stage has exitConditions: ${currentStageMetadata.exitConditions.join(', ')}`);
      log(`[STAGE EXECUTION] Setting instance to wait for primary exit event: ${primaryExitEvent}`);
      
      try {
        const updatedInstance = await updateInstanceStatusDirect(instance, 'active', {
          waitingForEvent: primaryExitEvent,
          nextStepId: nextStep.id,
          nextStepType: nextStep.type,
          nextStageName: nextStageStep.stageName,
        });
        log(`[STAGE EXECUTION] ✓ Instance ${updatedInstance.instanceId} is now WAITING FOR EVENT: ${primaryExitEvent}`);
        log(`[STAGE EXECUTION] ✓ Using exitConditions from current stage metadata`);
      } catch (error) {
        log(`[STAGE EXECUTION] ✗ Error setting waiting state: ${error}`);
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const retryInstance = await getInstance(instance.instanceId);
          await updateInstanceStatus(retryInstance.instanceId, 'active', {
            waitingForEvent: primaryExitEvent,
            nextStepId: nextStep.id,
            nextStepType: nextStep.type,
            nextStageName: nextStageStep.stageName,
            leadId: retryInstance.leadId,
          });
          log(`[STAGE EXECUTION] ✓ Successfully set waiting state on RETRY`);
        } catch (retryError) {
          log(`[STAGE EXECUTION] ✗ Error on retry: ${retryError}`);
        }
      }
    } else {
      // Traditional pipeline: Use next stage's trigger event
      const stageDefinition = getStageById(nextStageStep.stageId);
      log(`[STAGE EXECUTION] Next step is stage: ${nextStageStep.stageName} (${nextStageStep.stageId})`);
      log(`[STAGE EXECUTION] Trigger event for next stage: ${stageDefinition?.triggerEvent || 'NONE'}`);

      if (stageDefinition?.triggerEvent) {
        log(`[STAGE EXECUTION] Setting instance ${instance.instanceId} to wait for event: ${stageDefinition.triggerEvent}`);
        try {
          // Use the instance object directly - use updateInstanceStatusDirect to avoid re-querying
          const updatedInstance = await updateInstanceStatusDirect(instance, 'active', {
            waitingForEvent: stageDefinition.triggerEvent,
            nextStepId: nextStep.id,
            nextStepType: nextStep.type,
            nextStageName: nextStageStep.stageName,
          });
          log(`[STAGE EXECUTION] ✓ Instance ${updatedInstance.instanceId} is now WAITING FOR EVENT: ${stageDefinition.triggerEvent}`);
          log(`[STAGE EXECUTION] ✓ Instance state: ${updatedInstance.status}, waitingForEvent: ${updatedInstance.waitingForEvent}`);
        } catch (error) {
          log(`[STAGE EXECUTION] ✗ Error setting waiting state for instance ${instance.instanceId}: ${error}`);
          // Retry once with a delay to allow Cosmos DB to be consistent
          try {
            await new Promise(resolve => setTimeout(resolve, 1000));
            const retryInstance = await getInstance(instance.instanceId);
            const updatedInstance = await updateInstanceStatus(retryInstance.instanceId, 'active', {
              waitingForEvent: stageDefinition.triggerEvent,
              nextStepId: nextStep.id,
              nextStepType: nextStep.type,
              nextStageName: nextStageStep.stageName,
              leadId: retryInstance.leadId,
            });
            log(`[STAGE EXECUTION] ✓ Successfully set waiting state on RETRY for instance ${updatedInstance.instanceId}`);
          } catch (retryError) {
            log(`[STAGE EXECUTION] ✗ Error on retry setting waiting state: ${retryError}`);
            // Try to update next step info anyway (without waiting state)
            try {
              await updateNextStepInfo(instance.instanceId, nextStep);
              log(`[STAGE EXECUTION] Updated next step info without waiting state (fallback)`);
            } catch (updateError) {
              log(`[STAGE EXECUTION] ✗ Error updating next step info: ${updateError}`);
            }
          }
        }
      } else {
        log(`[STAGE EXECUTION] ⚠ Warning: Stage ${nextStageStep.stageId} has NO trigger event defined`);
        await updateNextStepInfo(instance.instanceId, nextStep);
      }
    }
  } else {
    // No next step or next step is a wait/approval step
    log(`[STAGE EXECUTION] Updating next step info to: ${nextStep ? nextStep.id : 'none'}`);
    await updateNextStepInfo(instance.instanceId, nextStep || null);
  }
}

/**
 * Execute a stage step - update the lead's stage and execute actions
 */
async function executeStageStep(
  instance: PipelineInstance,
  step: StageStep | EnhancedStageStep,
  log: (...args: unknown[]) => void,
  eventData?: EventData
): Promise<void> {
  log(`[EXECUTE STAGE] Starting execution of stage step: ${step.stageName} (${step.stageId})`);
  log(`[EXECUTE STAGE] Lead ID: ${instance.leadId}, Instance ID: ${instance.instanceId}`);

  // 1. Always update lead stage synchronously (critical path)
  await updateLeadStageSync(instance, step, log, eventData);

  // 2. Check if this is an enhanced stage step with action config
  const enhancedStep = step as EnhancedStageStep;
  if (enhancedStep.actionConfig?.primaryAction) {
    const action = enhancedStep.actionConfig.primaryAction;
    const pipeline = await getPipeline(instance.pipelineId);
    
    log(`[EXECUTE STAGE] Primary action type: ${action.type}`);
    
    switch (action.type) {
      case 'sync':
        if (action.syncAction) {
          await executeSyncAction(instance, pipeline, enhancedStep, action.syncAction, log);
        }
        break;
      case 'async':
        if (action.asyncAction) {
          await executeAsyncAction(instance, enhancedStep, action.asyncAction, log);
        }
        break;
      case 'manual':
        await setManualWaitState(instance, enhancedStep, log);
        break;
      case 'wait':
        // Wait state is handled by existing executeWaitStep
        break;
    }
    
    // Handle auto-advance if configured
    if (enhancedStep.actionConfig.autoAdvance?.enabled) {
      const delayMs = enhancedStep.actionConfig.autoAdvance.delayMs || 0;
      if (delayMs > 0) {
        log(`[EXECUTE STAGE] Auto-advance enabled with delay: ${delayMs}ms`);
        log(`[EXECUTE STAGE] Scheduling auto-advance via Storage Queue (durable execution)`);
        
        // Get next step for auto-advance
        const nextStep = getNextEnabledStep(pipeline.steps, step.id);
        if (nextStep) {
          // Schedule auto-advance via Storage Queue (replaces unsafe setTimeout)
          await scheduleDelayedAction('auto_advance', {
            instanceId: instance.instanceId,
            stepId: step.id,
            nextStepId: nextStep.id,
            triggeredBy: 'auto_advance',
          }, delayMs);
          log(`[EXECUTE STAGE] ✓ Auto-advance scheduled via queue for ${delayMs}ms delay`);
        } else {
          log(`[EXECUTE STAGE] No next step found for auto-advance - skipping`);
        }
      }
    }
  } else {
    // Legacy stage step - use existing logic
    log(`[EXECUTE STAGE] Legacy stage step - using existing execution logic`);
  }
}

/**
 * Update lead stage synchronously (helper function)
 */
async function updateLeadStageSync(
  instance: PipelineInstance,
  step: StageStep,
  log: (...args: unknown[]) => void,
  eventData?: EventData
): Promise<void> {
  // Map pipeline stage name to Lead Service stage ID
  const leadServiceStageId = STAGE_NAME_TO_LEAD_SERVICE_ID[step.stageName];

  if (!leadServiceStageId) {
    log(`[EXECUTE STAGE] ⚠ Warning: No Lead Service stage ID mapping found for stage "${step.stageName}" (stageId: ${step.stageId})`);
    log(`[EXECUTE STAGE] Pipeline stage "${step.stageName}" is not mapped to Lead Service - pipeline continues without lead service update`);
    return;
  }

  log(`[EXECUTE STAGE] Updating lead ${instance.leadId} to stage: ${step.stageName} (Lead Service ID: ${leadServiceStageId})`);
  log(`[EXECUTE STAGE] Lead Service URL: ${process.env.LEAD_SERVICE_URL || 'not set'}`);
  log(`[EXECUTE STAGE] Service Key configured: ${process.env.INTERNAL_SERVICE_KEY ? 'YES' : 'NO'}`);

  // Extract metadata from eventData if present
  const metadata = eventData?.metadata as Record<string, any> | undefined;
  if (metadata) {
    log(`[EXECUTE STAGE] ✓ Event metadata present, will include in timeline entry`);
    log(`[EXECUTE STAGE] Metadata content:`, JSON.stringify(metadata, null, 2));
  } else {
    log(`[EXECUTE STAGE] ⚠ No metadata found in eventData`);
    log(`[EXECUTE STAGE] eventData keys: ${Object.keys(eventData || {}).join(', ')}`);
  }

  // CRITICAL: Retry lead stage update with smart timeout handling
  let stageUpdateSuccess = false;
  let lastResult: UpdateLeadStageResult | null = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      log(`[EXECUTE STAGE] Attempting to update lead stage (attempt ${attempt}/3)...`);
      // Wrap Lead Service call with circuit breaker to prevent cascade failures
      const stageRequest = {
        stageId: leadServiceStageId,
        stageName: step.stageName,
        remark: `Pipeline: ${instance.pipelineName}`,
        changedBy: 'pipeline-service',
        metadata: metadata
      };
      
      log(`[EXECUTE STAGE] Sending stage update request with metadata:`, JSON.stringify(stageRequest.metadata || 'undefined', null, 2));
      
      lastResult = await leadServiceBreaker.execute(
        () => updateLeadStage(instance.leadId, instance.lineOfBusiness, stageRequest),
        'LeadService'
      );

      if (lastResult.success) {
        stageUpdateSuccess = true;
        log(`[EXECUTE STAGE] ✓ Successfully updated lead ${instance.leadId} to stage ${step.stageName} (attempt ${attempt})`);
        log(`[EXECUTE STAGE] ✓ Lead Service stage updated: stageId=${leadServiceStageId}, stageName=${step.stageName}`);

        // Verify the update by checking the lead (with retry)
        let verified = false;
        for (let verifyAttempt = 1; verifyAttempt <= 3; verifyAttempt++) {
          try {
            await new Promise(resolve => setTimeout(resolve, 500 * verifyAttempt)); // Wait for consistency
            const updatedLead = await getLead(instance.leadId, instance.lineOfBusiness);
            if (updatedLead) {
              log(`[EXECUTE STAGE] ✓ Verified: Lead currentStage="${updatedLead.currentStage}", stageId="${updatedLead.stageId}"`);
              if (updatedLead.currentStage !== step.stageName) {
                log(`[EXECUTE STAGE] ⚠ WARNING: Lead stage mismatch - expected "${step.stageName}", got "${updatedLead.currentStage}"`);
                log(`[EXECUTE STAGE] ⚠ This may be a timing issue - Lead Service may still be updating`);
                if (verifyAttempt < 3) {
                  continue; // Retry verification
                }
              } else {
                verified = true;
                break;
              }
            }
          } catch (verifyError) {
            log(`[EXECUTE STAGE] ⚠ Verification attempt ${verifyAttempt} failed: ${verifyError}`);
            if (verifyAttempt === 3) {
              log(`[EXECUTE STAGE] ⚠ Could not verify lead stage update after 3 attempts`);
            }
          }
        }

        break; // Success - exit retry loop
      } else if (lastResult.timeout) {
        // Timeout - verify if update actually succeeded before retrying
        log(`[EXECUTE STAGE] ⚠ Request timed out - verifying if update succeeded...`);
        
        // Wait a bit for eventual consistency
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const lead = await getLead(instance.leadId, instance.lineOfBusiness);
        if (lead && lead.currentStage === step.stageName && lead.stageId === leadServiceStageId) {
          log(`[EXECUTE STAGE] ✓ Update actually succeeded despite timeout - no retry needed`);
          stageUpdateSuccess = true;
          break;
        } else {
          log(`[EXECUTE STAGE] ⚠ Update did not succeed - will retry (attempt ${attempt}/3)`);
          if (attempt < 3) {
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
          }
        }
      } else {
        // Actual error - retry
        log(`[EXECUTE STAGE] ✗ Lead stage update failed (attempt ${attempt}/3): ${lastResult.error}`);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
        } else {
          log(`[EXECUTE STAGE] ✗ Failed to update lead stage after 3 attempts`);
          log(`[EXECUTE STAGE] ⚠ This may be due to Lead Service being unavailable or authentication issues`);
          log(`[EXECUTE STAGE] ⚠ Pipeline will continue, but lead stage may not be updated in Lead Service`);
          log(`[EXECUTE STAGE] ⚠ CRITICAL: Lead stage update failed - check LEAD_SERVICE_URL and INTERNAL_SERVICE_KEY`);
        }
      }
    } catch (error) {
      log(`[EXECUTE STAGE] ✗ Exception while updating lead stage (attempt ${attempt}/3): ${error}`);
      if (attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
      } else {
        log(`[EXECUTE STAGE] ✗ Exception during lead stage update after 3 attempts`);
        log(`[EXECUTE STAGE] ⚠ Pipeline will continue, but lead stage may not be updated in Lead Service`);
        log(`[EXECUTE STAGE] ⚠ CRITICAL: Exception during lead stage update - check error details above`);
      }
    }
  }

  if (!stageUpdateSuccess) {
    log(`[EXECUTE STAGE] ⚠ CRITICAL: Lead stage update failed after all retries`);
    log(`[EXECUTE STAGE] ⚠ The pipeline will continue, but the lead stage in Lead Service may be incorrect`);
    log(`[EXECUTE STAGE] ⚠ Manual intervention may be required to sync the lead stage`);
  }

  // Publish step changed event
  log(`[EXECUTE STAGE] Publishing pipeline.instance.step_changed event`);
  await publishPipelineInstanceStepChanged({
    instanceId: instance.instanceId,
    leadId: instance.leadId,
    previousStepId: null,
    currentStepId: step.id,
    currentStepType: 'stage',
    currentStageName: step.stageName,
  });

  log(`[EXECUTE STAGE] ✓ Stage step ${step.stageName} execution complete`);
}

// =============================================================================
// Enhanced Action Execution (Phase 2: Hybrid Sync/Async)
// =============================================================================

/**
 * Fail-fast validation before action execution
 */
function validateRequiredData(
  instance: PipelineInstance,
  requiredFields: string[],
  actionName: string
): void {
  const missingFields: string[] = [];
  
  for (const field of requiredFields) {
    const value = getNestedProperty(instance, field);
    if (value === undefined || value === null || value === '') {
      missingFields.push(field);
    }
  }
  
  if (missingFields.length > 0) {
    throw new Error(
      `[${actionName}] Missing required data: ${missingFields.join(', ')}. ` +
      `Instance ${instance.instanceId} cannot proceed.`
    );
  }
}

/**
 * Helper to get nested properties
 */
function getNestedProperty(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Prepare action data from instance and lead
 */
async function prepareActionData(
  instance: PipelineInstance,
  requiredFields: string[]
): Promise<Record<string, any>> {
  const actionData: Record<string, any> = {
    leadId: instance.leadId,
    instanceId: instance.instanceId,
    lineOfBusiness: instance.lineOfBusiness,
    businessType: instance.businessType,
  };

  // Get lead data for additional fields
  try {
    const lead = await getLead(instance.leadId, instance.lineOfBusiness);
    if (lead) {
      // Add common lead fields
      actionData.customerId = lead.customerId;
      actionData.lobData = lead.lobData;
      
      // Extract specific required fields from lead
      for (const field of requiredFields) {
        if (field.startsWith('lobData.')) {
          const fieldPath = field.replace('lobData.', '');
          const value = getNestedProperty(lead.lobData, fieldPath);
          if (value !== undefined) {
            if (!actionData.lobData) actionData.lobData = {};
            actionData.lobData[fieldPath] = value;
          }
        } else if (field !== 'leadId' && field !== 'lineOfBusiness' && field !== 'businessType') {
          const value = getNestedProperty(lead, field);
          if (value !== undefined) {
            actionData[field] = value;
          }
        }
      }
    }
  } catch (error) {
    // Log but don't fail - we'll validate required fields separately
    console.warn(`Could not fetch lead data for action preparation: ${error}`);
  }

  return actionData;
}

/**
 * Execute synchronous action (API call)
 */
export async function executeSyncAction(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  step: EnhancedStageStep,
  config: SyncActionConfig,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`[SYNC ACTION] ${config.method} ${config.targetService}${config.endpoint}`);

  // Validate before execution
  try {
    validateRequiredData(instance, config.requiredData, `SYNC:${config.endpoint}`);
  } catch (error: any) {
    log(`[VALIDATION ERROR] ${error.message}`);
    await recordError(instance.instanceId, step.id, error);
    throw error;
  }

  try {
    const requestData = await prepareActionData(instance, config.requiredData);
    
    const response = await httpRequest({
      method: config.method,
      url: `${getServiceUrl(config.targetService)}${config.endpoint}`,
      data: requestData,
      timeout: config.timeout,
      headers: {
        'x-service-key': process.env.INTERNAL_SERVICE_KEY || '',
        'x-correlation-id': uuidv4(),
        'x-instance-id': instance.instanceId,
      },
    });

    log(`[SYNC ACTION] Success`);

    // Handle success - use pipeline parameter passed by caller
    if (config.onSuccess?.nextStage) {
      const nextStep = findStepByStageId(pipeline.steps, config.onSuccess.nextStage);
      if (nextStep) {
        await advanceToStep(instance, pipeline, step, nextStep, 'sync_success', 'completed', log);
      }
    }

    // Update instance data if specified
    if (config.onSuccess?.updateData) {
      // Interpolate data from response
      const updateData: Record<string, any> = {};
      for (const [key, value] of Object.entries(config.onSuccess.updateData)) {
        if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
          const path = value.slice(2, -2);
          updateData[key] = getNestedProperty(response, path);
        } else {
          updateData[key] = value;
        }
      }
      // Store in instance metadata or update directly
      await updateInstanceStatusDirect(instance, instance.status, updateData);
    }
  } catch (error: any) {
    log(`[SYNC ACTION] Failed: ${error.message}`);
    
    // Retry logic
    if (config.onFailure?.retryPolicy) {
      const retryCount = instance.actionRetryCount || 0;
      if (retryCount < config.onFailure.retryPolicy.maxRetries) {
        log(`[SYNC ACTION] Scheduling retry ${retryCount + 1}/${config.onFailure.retryPolicy.maxRetries}`);
        log(`[SYNC ACTION] Using Storage Queue for durable retry execution`);
        await updateInstanceStatusDirect(instance, instance.status, {
          actionRetryCount: retryCount + 1,
        });
        
        // Schedule retry via Storage Queue (replaces unsafe setTimeout)
        await scheduleDelayedAction('sync_retry', {
          instanceId: instance.instanceId,
          stepId: step.id,
          config,
        }, config.onFailure.retryPolicy.delayMs);
        
        // Track retry scheduling
        trackPipelineEvent('ActionRetryScheduled', {
          instanceId: instance.instanceId,
          stepId: step.id,
          actionType: 'sync',
          retryCount: retryCount + 1,
          maxRetries: config.onFailure.retryPolicy.maxRetries,
          delayMs: config.onFailure.retryPolicy.delayMs,
        });
        
        log(`[SYNC ACTION] ✓ Retry scheduled via queue for ${config.onFailure.retryPolicy.delayMs}ms delay`);
        return;
      }
    }

    // Fallback stage
    if (config.onFailure?.fallbackStage) {
      const pipeline = await getPipeline(instance.pipelineId);
      const fallbackStep = findStepByStageId(pipeline.steps, config.onFailure.fallbackStage);
      if (fallbackStep) {
        await advanceToStep(instance, pipeline, step, fallbackStep, 'sync_failure', 'completed', log);
      }
    }

    await recordError(instance.instanceId, step.id, error);
    throw error;
  }
}

/**
 * Execute asynchronous action (Event)
 */
export async function executeAsyncAction(
  instance: PipelineInstance,
  step: EnhancedStageStep,
  config: AsyncActionConfig,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`[ASYNC ACTION] ${config.actionEvent}`);

  // Validate before execution
  try {
    validateRequiredData(instance, config.requiredData, `ASYNC:${config.actionEvent}`);
  } catch (error: any) {
    log(`[VALIDATION ERROR] ${error.message}`);
    await recordError(instance.instanceId, step.id, error);
    throw error;
  }

  const correlationId = uuidv4();
  const actionData = await prepareActionData(instance, config.requiredData);

  try {
    await publishActionEvent({
      eventType: config.actionEvent,
      data: {
        instanceId: instance.instanceId,
        leadId: instance.leadId,
        lineOfBusiness: instance.lineOfBusiness,
        businessType: instance.businessType,
        currentStage: step.stageName,
        actionData,
        metadata: {
          correlationId,
          pipelineId: instance.pipelineId,
          timestamp: new Date().toISOString(),
        },
      },
    });

    log(`[ASYNC ACTION] Event published: ${config.actionEvent}`);

    // Extract short action name from event (e.g., 'pipeline.action.fetch_plans' -> 'fetch_plans')
    const actionName = config.actionEvent.replace('pipeline.action.', '');

    // Set waiting state
    await updateInstanceStatusDirect(instance, instance.status, {
      waitingForEvent: config.completionEvent,
      waitingForAction: actionName,
      actionCorrelationId: correlationId,
      actionStartedAt: new Date().toISOString(),
      actionDeadline: new Date(Date.now() + config.timeout).toISOString(),
      waitingForService: config.targetService,
    });

    log(`[ASYNC ACTION] Waiting for ${config.completionEvent}`);
  } catch (error: any) {
    log(`[ASYNC ACTION] Failed to emit event: ${error.message}`);
    
    // Retry event emission
    if (config.retryPolicy) {
      const retryCount = instance.actionRetryCount || 0;
      if (retryCount < config.retryPolicy.maxRetries) {
        log(`[ASYNC ACTION] Scheduling retry ${retryCount + 1}/${config.retryPolicy.maxRetries}`);
        log(`[ASYNC ACTION] Using Storage Queue for durable retry execution`);
        await updateInstanceStatusDirect(instance, instance.status, {
          actionRetryCount: retryCount + 1,
        });
        
        // Schedule retry via Storage Queue (replaces unsafe setTimeout)
        await scheduleDelayedAction('async_retry', {
          instanceId: instance.instanceId,
          stepId: step.id,
          config,
        }, config.retryPolicy.retryDelayMs);
        
        // Track retry scheduling
        trackPipelineEvent('ActionRetryScheduled', {
          instanceId: instance.instanceId,
          stepId: step.id,
          actionType: 'async',
          retryCount: retryCount + 1,
          maxRetries: config.retryPolicy.maxRetries,
          delayMs: config.retryPolicy.retryDelayMs,
        });
        
        log(`[ASYNC ACTION] ✓ Retry scheduled via queue for ${config.retryPolicy.retryDelayMs}ms delay`);
        return;
      }
    }
    
    await recordError(instance.instanceId, step.id, error);
    throw error;
  }
}

/**
 * Handle action failure
 */
async function handleActionFailure(
  instance: PipelineInstance,
  error: { code: string; message: string; retryable: boolean }
): Promise<void> {
  await recordError(instance.instanceId, instance.currentStepId, error.message);
  
  // Could route to error stage or mark as failed
  // For now, just log and update status
  if (!error.retryable) {
    await updateInstanceStatus(instance.instanceId, 'failed', {
      lastError: {
        stepId: instance.currentStepId,
        message: error.message,
        timestamp: new Date().toISOString(),
      },
    });
  }
}

/**
 * Set manual wait state (for user-triggered actions)
 */
async function setManualWaitState(
  instance: PipelineInstance,
  step: EnhancedStageStep,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`[MANUAL WAIT] Stage ${step.stageName} waiting for user action`);
  // Instance stays in current state, waiting for user to trigger an allowed action
}

/**
 * Execute an approval step - create an approval request
 */
async function executeApprovalStep(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  step: ApprovalStep,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Creating approval request for role ${step.approverRole}`);

  // Get lead summary for context
  const leadSummary = await getLeadSummary(instance.leadId, instance.lineOfBusiness);

  const approval = await createApproval({
    instanceId: instance.instanceId,
    pipelineId: pipeline.pipelineId,
    leadId: instance.leadId,
    stepId: step.id,
    stepName: step.name || `Approval: ${step.approverRole}`,
    approverRole: step.approverRole,
    escalationRole: step.escalationRole,
    timeoutHours: step.timeoutHours,
    leadReferenceId: (leadSummary?.referenceId as string) || undefined,
    leadSummary: leadSummary || undefined,
  });

  // Set instance to waiting for approval
  await setWaitingForApproval(instance.instanceId, approval.approvalId, approval.expiresAt);

  // Publish approval required event
  await publishApprovalRequired({
    approvalId: approval.approvalId,
    instanceId: instance.instanceId,
    leadId: instance.leadId,
    approverRole: step.approverRole,
    stepName: step.name || `Approval: ${step.approverRole}`,
  });
}

/**
 * Execute a decision step - evaluate condition and branch
 */
async function executeDecisionStep(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  step: DecisionStep,
  triggeredBy: string,
  log: (...args: unknown[]) => void,
  eventData?: EventData
): Promise<void> {
  log(`Evaluating condition ${step.conditionType}`);
  log(`[DECISION STEP] Event data provided: ${eventData ? 'YES' : 'NO'}`);
  if (eventData) {
    log(`[DECISION STEP] Event data keys: ${Object.keys(eventData).join(', ')}`);
    log(`[DECISION STEP] Event data: responseType=${eventData.responseType || 'none'}, selectedPlanId=${eventData.selectedPlanId || 'none'}`);
    log(`[DECISION STEP] Event data full: ${JSON.stringify(eventData)}`);
  }

  // For quotation_approved condition, check responseType first for special routing
  let nextStepId: string | null = null;
  let conditionMet: boolean | null = null;
  
  if (step.conditionType === 'quotation_approved' && eventData?.responseType) {
    const responseType = eventData.responseType as string;
    
    // Handle special response types that need different routing
    if (responseType === 'request_revision') {
      log(`[DECISION STEP] Customer requested revision - routing to Revision Requested stage`);
      // Find Revision Requested stage step in pipeline
      const revisionStep = pipeline.steps.find(s => 
        s.type === 'stage' && 
        (s as any).stageId === 'revision-requested'
      );
      if (revisionStep) {
        nextStepId = revisionStep.id;
        conditionMet = false; // Not approved, but routed to revision
      } else {
        log(`[DECISION STEP] ⚠ Warning: Revision Requested stage not found in pipeline, using false branch`);
        nextStepId = step.falseNextStepId;
        conditionMet = false;
      }
    } else if (responseType === 'reject_plans') {
      log(`[DECISION STEP] Customer rejected plans - routing to Lost stage`);
      // Find Lost stage step in pipeline
      const lostStep = pipeline.steps.find(s => 
        s.type === 'stage' && 
        (s as any).stageId === 'lost'
      );
      if (lostStep) {
        nextStepId = lostStep.id;
        conditionMet = false; // Not approved, routed to lost
      } else {
        nextStepId = step.falseNextStepId;
        conditionMet = false;
      }
    } else if (responseType === 'plan_selected') {
      // CRITICAL FIX: Explicitly handle plan_selected to route to Pending Review
      // This MUST be done BEFORE normal evaluation to avoid race conditions
      // If wait step advanced with plan_selected, we can trust that a plan was selected
      // (wait step already validated selectedPlanId before advancing)
      const selectedPlanId = eventData.selectedPlanId;
      // Handle cases where selectedPlanId might be a string, number, or other type
      const selectedPlanIdStr = selectedPlanId ? String(selectedPlanId).trim() : '';
      const hasValidSelectedPlan = selectedPlanIdStr.length > 0;
      
      log(`[DECISION STEP] Customer selected plan - responseType="${responseType}", selectedPlanId="${selectedPlanId}" (as string: "${selectedPlanIdStr}")`);
      log(`[DECISION STEP] Valid selected plan: ${hasValidSelectedPlan}`);
      
      // CRITICAL: If responseType is 'plan_selected', always route to Pending Review
      // The wait step already validated that a plan was selected before advancing
      // Even if selectedPlanId is missing here (unlikely), we trust the responseType
      log(`[DECISION STEP] ✓ Customer selected plan (responseType: ${responseType}) - routing to Pending Review stage`);
      // Use trueNextStepId which should be Pending Review (true branch = approved)
      nextStepId = step.trueNextStepId;
      conditionMet = true; // Plan selected = approved, route to true branch
      log(`[DECISION STEP] Routing to trueNextStepId: ${nextStepId} (Pending Review)`);
      
      if (!hasValidSelectedPlan) {
        log(`[DECISION STEP] ⚠ WARNING: plan_selected response but selectedPlanId is missing/invalid - routing anyway based on responseType`);
        log(`[DECISION STEP] selectedPlanId type: ${typeof selectedPlanId}, value: ${selectedPlanId}`);
      }
    }
    // If responseType is other, continue with normal evaluation
  }

  // If no special routing was determined, evaluate condition normally
  if (!nextStepId) {
    // Evaluate the condition - PASS EVENT DATA to avoid race condition
    conditionMet = await evaluateLeadCondition(
      instance.leadId,
      instance.lineOfBusiness,
      step.conditionType,
      step.conditionValue,
      eventData,
      log
    );

    log(`Condition ${step.conditionType} = ${conditionMet}`);

    // Determine next step based on condition result
    nextStepId = conditionMet ? step.trueNextStepId : step.falseNextStepId;
  }

  // Track decision evaluation
  trackPipelineEvent('DecisionEvaluated', {
    instanceId: instance.instanceId,
    leadId: instance.leadId,
    conditionType: step.conditionType,
    outcome: String(conditionMet),
    nextStepId: nextStepId || 'none',
    triggeredBy,
  });

  // Handle special values from the UI
  if (nextStepId === 'end') {
    // "end" means complete the pipeline
    log(`Decision step outcome ${conditionMet} leads to pipeline end`);
    await completeInstance(instance, 'completed', log);
    return;
  }

  let nextStep: PipelineStep | null = null;

  if (nextStepId === 'next') {
    // "next" means proceed to the next sequential enabled step after the decision step
    nextStep = getNextEnabledStep(pipeline.steps, step.id);
    log(`Decision step outcome ${conditionMet} advances to next sequential step`);
  } else {
    // Look for the specific step by ID
    const targetStep = pipeline.steps.find(s => s.id === nextStepId);

    if (targetStep) {
      if (targetStep.enabled) {
        // Target step is enabled - use it
        nextStep = targetStep;
      } else {
        // Target step is disabled - skip to the next enabled step after it
        log(`Target step ${nextStepId} is disabled, skipping to next enabled step`);
        nextStep = getNextEnabledStep(pipeline.steps, targetStep.id);
      }
    }
  }

  if (nextStep) {
    log(`[DECISION STEP] ✓ Routing to next step: ${nextStep.id} (${nextStep.type})`);
    if (nextStep.type === 'stage') {
      const stageStep = nextStep as StageStep;
      log(`[DECISION STEP] Next stage: ${stageStep.stageName} (${stageStep.stageId})`);
    }
    const updatedInstance = await moveToStep(instance.instanceId, nextStep, triggeredBy, 'branched');
    await executeStep(updatedInstance, pipeline, nextStep, triggeredBy, log, eventData);
  } else {
    log(`[DECISION STEP] ✗ ERROR: Decision step has no valid next step for outcome ${conditionMet} (nextStepId: ${nextStepId})`);
    log(`[DECISION STEP] trueNextStepId: ${step.trueNextStepId}, falseNextStepId: ${step.falseNextStepId}`);
    await completeInstance(instance, 'completed', log);
  }
}

/**
 * Execute a notification step - trigger a notification
 */
async function executeNotificationStep(
  instance: PipelineInstance,
  step: NotificationStep,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Triggering notification ${step.notificationType}`);

  // Get notification definition
  const notificationDef = getNotificationById(step.notificationType);
  if (!notificationDef) {
    log(`Unknown notification type: ${step.notificationType}`);
    return;
  }

  // Get lead summary for notification context
  const leadSummary = await getLeadSummary(instance.leadId, instance.lineOfBusiness);

  // Publish notification event for notification service to consume
  await publishPipelineNotificationRequired({
    instanceId: instance.instanceId,
    leadId: instance.leadId,
    lineOfBusiness: instance.lineOfBusiness,
    notificationType: step.notificationType,
    channel: notificationDef.channel,
    recipientType: notificationDef.recipientType,
    templateId: notificationDef.templateId,
    customMessage: step.customMessage,
    leadReferenceId: leadSummary?.referenceId as string | undefined,
    customerName: leadSummary?.customerName as string | undefined,
    stageName: instance.currentStageName,
  });

  log(`Published ${notificationDef.channel} notification request for ${notificationDef.recipientType}: ${notificationDef.name}`);
}

/**
 * Execute a wait step - set instance to waiting state
 */
async function executeWaitStep(
  instance: PipelineInstance,
  step: WaitStep,
  log: (...args: unknown[]) => void
): Promise<void> {
  const waitEvent = getWaitEventById(step.waitForEvent);
  if (!waitEvent) {
    log(`Unknown wait event: ${step.waitForEvent}`);
    return;
  }

  log(`Waiting for event ${waitEvent.eventType}`);

  // Calculate timeout
  let timeoutAt: string | undefined;
  const timeoutHours = step.timeoutHours ?? waitEvent.defaultTimeoutHours;
  if (timeoutHours > 0) {
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() + timeoutHours);
    timeoutAt = timeoutDate.toISOString();
  }

  await setWaitingForEvent(instance.instanceId, waitEvent.eventType || step.waitForEvent, timeoutAt);
}

// =============================================================================
// Step Advancement
// =============================================================================

/**
 * Advance instance to a new step
 */
export async function advanceToStep(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  fromStep: PipelineStep,
  toStep: PipelineStep,
  triggeredBy: string,
  outcome: 'completed' | 'approved' | 'rejected' | 'branched' | undefined,
  log: (...args: unknown[]) => void,
  eventData?: EventData
): Promise<void> {
  log(`[ADVANCE TO STEP] ========================================`);
  log(`[ADVANCE TO STEP] Advancing from: ${fromStep.id} (${fromStep.type})`);
  log(`[ADVANCE TO STEP] Advancing to: ${toStep.id} (${toStep.type})`);
  if (toStep.type === 'stage') {
    const stageStep = toStep as StageStep;
    log(`[ADVANCE TO STEP] New stage: ${stageStep.stageName} (${stageStep.stageId})`);
  }
  log(`[ADVANCE TO STEP] Triggered by: ${triggeredBy}`);
  log(`[ADVANCE TO STEP] Event data provided: ${eventData ? 'YES' : 'NO'}`);
  if (eventData) {
    log(`[ADVANCE TO STEP] Event data keys: ${Object.keys(eventData).join(', ')}`);
    if (eventData.responseType) {
      log(`[ADVANCE TO STEP] Event data responseType: ${eventData.responseType}`);
    }
    if (eventData.selectedPlanId) {
      log(`[ADVANCE TO STEP] Event data selectedPlanId: ${eventData.selectedPlanId}`);
    }
  }

  // Move to the new step (updates instance in database)
  // CRITICAL: Pass the instance object and leadId to avoid re-querying and potential ID mismatches
  log(`[ADVANCE TO STEP] Moving instance to new step in database...`);
  log(`[ADVANCE TO STEP] Using instance ID: ${instance.id}, instanceId: ${instance.instanceId}, leadId: ${instance.leadId}`);
  const updatedInstance = await moveToStep(instance.instanceId, toStep, triggeredBy, outcome, instance, instance.leadId);
  log(`[ADVANCE TO STEP] ✓ Instance moved to step ${toStep.id}`);
  log(`[ADVANCE TO STEP] Instance progress: ${updatedInstance.progressPercent}% (${updatedInstance.completedStepsCount}/${updatedInstance.totalStepsCount})`);

  // Execute the new step (updates lead stage and sets waiting state)
  log(`[ADVANCE TO STEP] Executing new step...`);
  await executeStep(updatedInstance, pipeline, toStep, triggeredBy, log, eventData);
  log(`[ADVANCE TO STEP] ✓ Step execution complete`);
  log(`[ADVANCE TO STEP] ========================================`);
}

/**
 * Complete the pipeline instance
 */
async function completeInstance(
  instance: PipelineInstance,
  status: 'completed' | 'failed' | 'cancelled',
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Completing pipeline instance ${instance.instanceId} with status ${status}`);

  await updateInstanceStatus(instance.instanceId, status);

  // Track pipeline completion
  trackPipelineEvent('PipelineCompleted', {
    instanceId: instance.instanceId,
    pipelineId: instance.pipelineId,
    leadId: instance.leadId,
    status,
    progressPercent: instance.progressPercent || 0,
  });

  await publishPipelineInstanceCompleted({
    instanceId: instance.instanceId,
    pipelineId: instance.pipelineId,
    leadId: instance.leadId,
    finalStatus: status,
  });
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get the next enabled step after the current one
 */
function getNextEnabledStep(
  steps: PipelineStep[],
  currentStepId: string
): PipelineStep | null {
  const sortedSteps = [...steps].sort((a, b) => a.order - b.order);
  const currentIndex = sortedSteps.findIndex(s => s.id === currentStepId);

  if (currentIndex === -1) return null;

  for (let i = currentIndex + 1; i < sortedSteps.length; i++) {
    if (sortedSteps[i].enabled) {
      return sortedSteps[i];
    }
  }

  return null;
}

/**
 * Get the next step based on the outcome
 */
function getNextStepForOutcome(
  pipeline: PipelineDefinition,
  currentStep: PipelineStep,
  outcome?: 'completed' | 'approved' | 'rejected' | 'branched'
): PipelineStep | null {
  // For decision steps, the next step is already determined during execution
  if (currentStep.type === 'decision') {
    return null; // Decision step handles its own advancement
  }

  return getNextEnabledStep(pipeline.steps, currentStep.id);
}

// =============================================================================
// Approval Handling
// =============================================================================

// =============================================================================
// Service Completion Event Handling
// =============================================================================

/**
 * Handle service completion event
 */
async function handleServiceCompletion(
  eventType: string,
  eventData: EventData,
  log: (...args: unknown[]) => void,
  requestId?: string
): Promise<ProcessEventResult> {
  const { instanceId, actionCompleted, status, result, error } = eventData as any;

  log(`[COMPLETION] ${actionCompleted} - ${status}${requestId ? ` (requestId: ${requestId})` : ''}`);

  if (!instanceId) {
    log(`[COMPLETION] ✗ No instanceId in completion event`);
    return { processed: false, error: 'No instanceId in completion event' };
  }

  const instance = await getInstance(instanceId);
  if (!instance) {
    log(`[COMPLETION] ✗ Instance ${instanceId} not found`);
    return { processed: false, error: 'Instance not found' };
  }

  // Validate completion matches expected action
  if (instance.waitingForAction !== actionCompleted) {
    log(`[COMPLETION] ✗ Unexpected completion: expected ${instance.waitingForAction}, got ${actionCompleted}`);
    return { processed: false, error: 'Unexpected completion' };
  }

  // Check correlation ID (prevent duplicates)
  const correlationId = (eventData as any).metadata?.correlationId;
  if (correlationId && instance.actionCorrelationId && correlationId !== instance.actionCorrelationId) {
    log(`[COMPLETION] ✗ Correlation ID mismatch - duplicate or late event`);
    return { processed: false, error: 'Correlation ID mismatch' };
  }

  // Get pipeline and validate current step exists BEFORE updating anything
  const pipeline = await getPipeline(instance.pipelineId);
  const currentStep = findStepById(pipeline.steps, instance.currentStepId);
  
  if (!currentStep) {
    log(`[COMPLETION] ✗ Current step ${instance.currentStepId} not found in pipeline`);
    // Clear waiting fields even though step not found to prevent inconsistent state
    await updateInstanceStatusDirect(instance, instance.status, {
      waitingForAction: undefined,
      waitingForService: undefined,
      actionCorrelationId: undefined,
      actionStartedAt: undefined,
      actionDeadline: undefined,
      actionRetryCount: 0,
    });
    await recordError(instance.instanceId, instance.currentStepId, 'Current step not found in pipeline during completion');
    return {
      processed: false,
      error: 'Current step not found in pipeline',
    };
  }

  // Clear waiting fields only - do NOT update step history here
  // moveToStep (called by advanceToStep) will handle step history updates to avoid double-update bugs
  // Bug Fix #1: Removed manual step history update to let moveToStep handle it atomically
  // Bug Fix #2: Capture the returned fresh instance with updated _etag to avoid 412 conflicts
  // 
  // TODO: Consider storing detailed action completion metadata (actionCompleted, result, error) 
  // in a separate action results collection or instance metadata for audit trails
  const refreshedInstance = await updateInstanceStatusDirect(instance, instance.status, {
    waitingForAction: undefined,
    waitingForService: undefined,
    actionCorrelationId: undefined,
    actionStartedAt: undefined,
    actionDeadline: undefined,
    actionRetryCount: 0,
  });

  if (status === 'success') {
    // Determine next step
    const nextStep = determineNextStep(pipeline, refreshedInstance, currentStep, result);

    if (nextStep) {
      // Use refreshedInstance (with updated _etag) to avoid 412 conflicts in moveToStep
      await advanceToStep(refreshedInstance, pipeline, currentStep, nextStep, actionCompleted, 'completed', log);
      return {
        processed: true,
        instanceId: instance.instanceId,
        action: `advanced_to_${nextStep.id}`,
      };
    } else {
      // No next step: pipeline complete
      await completeInstance(refreshedInstance, 'completed', log);
      return {
        processed: true,
        instanceId: instance.instanceId,
        action: 'pipeline_completed',
      };
    }
  } else {
    // Handle failure
    await handleActionFailure(refreshedInstance, error || {
      code: 'ACTION_FAILED',
      message: 'Service action failed',
      retryable: false,
    });
    return {
      processed: true,
      instanceId: instance.instanceId,
      action: 'action_failed',
    };
  }
}

/**
 * Find step by ID
 */
function findStepById(steps: PipelineStep[], stepId: string): PipelineStep | undefined {
  return steps.find(s => s.id === stepId);
}

/**
 * Find step by stage ID
 */
function findStepByStageId(steps: PipelineStep[], stageId: string): PipelineStep | undefined {
  return steps.find(s => s.type === 'stage' && (s as StageStep).stageId === stageId);
}

/**
 * Determine next step based on pipeline and result
 */
function determineNextStep(
  pipeline: PipelineDefinition,
  instance: PipelineInstance,
  currentStep: PipelineStep | undefined,
  result: Record<string, any>
): PipelineStep | null {
  if (!currentStep) {
    return getNextEnabledStep(pipeline.steps, instance.currentStepId);
  }
  
  // Check if current step is enhanced with action config
  const enhancedStep = currentStep as EnhancedStageStep;
  if (enhancedStep.actionConfig?.primaryAction?.type === 'async') {
    // For async actions, just get the next sequential step
    return getNextEnabledStep(pipeline.steps, currentStep.id);
  }
  
  return getNextEnabledStep(pipeline.steps, currentStep.id);
}

/**
 * Handle an approval decision
 */
export async function handleApprovalDecision(
  approvalId: string,
  decision: 'approved' | 'rejected',
  decidedBy: string,
  decidedByName?: string,
  comment?: string,
  log: (...args: unknown[]) => void = console.log
): Promise<ProcessEventResult> {
  try {
    // Submit the decision
    const approval = await submitDecision(
      approvalId,
      decision,
      decidedBy,
      decidedByName,
      comment
    );

    // Get the instance
    const instance = await getInstance(approval.instanceId);
    if (!instance) {
      return { processed: false, error: 'Instance not found' };
    }

    // Process as an approval decision event
    return await processEvent('pipeline.approval.decided', {
      leadId: instance.leadId,
      lineOfBusiness: instance.lineOfBusiness,
      approvalId,
      decision,
      decidedBy,
    }, { log });
  } catch (error) {
    log(`Error handling approval decision: ${error}`);
    return { processed: false, error: String(error) };
  }
}

