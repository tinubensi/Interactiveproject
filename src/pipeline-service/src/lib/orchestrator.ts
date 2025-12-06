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
  updateNextStepInfo,
  recordError,
} from '../repositories/instanceRepository';

import {
  createApproval,
  getApprovalByInstanceId,
  submitDecision,
} from '../repositories/approvalRepository';

import {
  updateLeadStage,
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

import {
  getStageById,
  getStageByTriggerEvent,
  getWaitEventById,
  getNotificationById,
  EVENT_TO_STAGE_MAP,
} from '../constants/predefined';

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
  context?: { log: (...args: unknown[]) => void }
): Promise<ProcessEventResult> {
  const log = context?.log || console.log;
  
  const leadId = eventData.leadId;
  if (!leadId) {
    log(`Event ${eventType} has no leadId - skipping`);
    return { processed: false, error: 'No leadId in event' };
  }

  log(`Processing event ${eventType} for lead ${leadId}`);

  try {
    // Special case: lead.created - start a new pipeline instance
    if (eventType === 'lead.created') {
      return await handleLeadCreated(eventData, log);
    }

    // For all other events, find the active instance for this lead
    const instance = await getInstanceByLeadId(leadId);
    if (!instance) {
      log(`No active pipeline instance for lead ${leadId}`);
      return { processed: false, error: 'No active pipeline instance' };
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

  if (!lineOfBusiness) {
    log(`lead.created event missing lineOfBusiness`);
    return { processed: false, error: 'Missing lineOfBusiness' };
  }

  // Check if there's already an active instance for this lead
  const existingInstance = await getInstanceByLeadId(leadId);
  if (existingInstance) {
    log(`Lead ${leadId} already has an active pipeline instance`);
    return { processed: false, error: 'Pipeline instance already exists' };
  }

  // Find the active pipeline for this LOB
  const pipeline = await getActivePipelineForLOB(lineOfBusiness, businessType);
  if (!pipeline) {
    log(`No active pipeline found for ${lineOfBusiness}/${businessType}`);
    return { processed: false, error: 'No active pipeline for LOB' };
  }

  // Create a new instance
  const instance = await createInstance(pipeline, leadId, 'lead.created');
  log(`Created pipeline instance ${instance.instanceId} for lead ${leadId}`);

  // Publish instance created event
  await publishPipelineInstanceCreated({
    instanceId: instance.instanceId,
    pipelineId: pipeline.pipelineId,
    leadId,
    lineOfBusiness,
  });

  // Execute the entry step
  const entryStep = pipeline.steps.find(s => s.id === instance.currentStepId);
  if (entryStep) {
    await executeStep(instance, pipeline, entryStep, 'lead.created', log);
  }

  return {
    processed: true,
    instanceId: instance.instanceId,
    action: 'pipeline_started',
  };
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

  switch (currentStep.type) {
    case 'stage':
      // Stage steps advance when the trigger event for the NEXT stage arrives
      const nextStep = getNextEnabledStep(pipeline.steps, currentStep.id);
      if (nextStep?.type === 'stage') {
        const nextStageStep = nextStep as StageStep;
        const expectedEvent = getStageById(nextStageStep.stageId)?.triggerEvent;
        shouldAdvance = eventType === expectedEvent;
      } else if (nextStep) {
        // Next step is not a stage - check if current stage is complete
        shouldAdvance = true;
      }
      outcome = 'completed';
      break;

    case 'wait':
      const waitStep = currentStep as WaitStep;
      const waitEvent = getWaitEventById(waitStep.waitForEvent);
      shouldAdvance = eventType === waitEvent?.eventType;
      outcome = 'completed';
      break;

    case 'approval':
      // Approvals are handled via the approval.decided event
      if (eventType === 'pipeline.approval.decided') {
        const decision = eventData.decision as 'approved' | 'rejected';
        shouldAdvance = true;
        outcome = decision;
        
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
      break;
  }

  if (!shouldAdvance) {
    log(`Event ${eventType} does not advance current step ${currentStep.id}`);
    return { processed: false, action: 'no_advancement' };
  }

  // Advance to the next step
  const nextStep = getNextStepForOutcome(pipeline, currentStep, outcome);
  if (nextStep) {
    await advanceToStep(instance, pipeline, currentStep, nextStep, eventType, outcome, log);
    return {
      processed: true,
      instanceId: instance.instanceId,
      action: `advanced_to_${nextStep.id}`,
    };
  } else {
    // No next step - pipeline is complete
    await completeInstance(instance, 'completed', log);
    return {
      processed: true,
      instanceId: instance.instanceId,
      action: 'pipeline_completed',
    };
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
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Executing step ${step.id} (${step.type}) for instance ${instance.instanceId}`);

  switch (step.type) {
    case 'stage':
      await executeStageStep(instance, step as StageStep, log);
      break;

    case 'approval':
      await executeApprovalStep(instance, pipeline, step as ApprovalStep, log);
      return; // Don't auto-advance - wait for approval

    case 'decision':
      await executeDecisionStep(instance, pipeline, step as DecisionStep, triggeredBy, log);
      return; // Decision step handles its own advancement

    case 'notification':
      await executeNotificationStep(instance, step as NotificationStep, log);
      // Notification steps always auto-advance to the next step
      {
        const nextStep = getNextEnabledStep(pipeline.steps, step.id);
        if (nextStep) {
          const updatedInstance = await getInstance(instance.instanceId);
          await advanceToStep(updatedInstance, pipeline, step, nextStep, triggeredBy, 'completed', log);
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
  const nextStep = getNextEnabledStep(pipeline.steps, step.id);
  if (nextStep && (nextStep.type === 'decision' || nextStep.type === 'notification')) {
    // Auto-execute immediate steps
    const updatedInstance = await getInstance(instance.instanceId);
    await advanceToStep(updatedInstance, pipeline, step, nextStep, triggeredBy, 'completed', log);
  } else {
    // Update next step info - stage steps wait for external events to advance
    await updateNextStepInfo(instance.instanceId, nextStep || null);
  }
}

/**
 * Execute a stage step - update the lead's stage
 */
async function executeStageStep(
  instance: PipelineInstance,
  step: StageStep,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Updating lead ${instance.leadId} to stage ${step.stageName}`);

  // Map our predefined stage ID to the Lead Service's stage ID format
  const stageDefinition = getStageById(step.stageId);
  const leadServiceStageId = `stage-${stageDefinition?.order || 1}`;

  const success = await updateLeadStage(instance.leadId, instance.lineOfBusiness, {
    stageId: leadServiceStageId,
    stageName: step.stageName,
    remark: `Pipeline: ${instance.pipelineName}`,
    changedBy: 'pipeline-service',
  });

  if (!success) {
    log(`Warning: Failed to update lead stage for ${instance.leadId}`);
  }

  // Publish step changed event
  await publishPipelineInstanceStepChanged({
    instanceId: instance.instanceId,
    leadId: instance.leadId,
    previousStepId: null,
    currentStepId: step.id,
    currentStepType: 'stage',
    currentStageName: step.stageName,
  });
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
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Evaluating condition ${step.conditionType}`);

  // Evaluate the condition
  const conditionMet = await evaluateLeadCondition(
    instance.leadId,
    instance.lineOfBusiness,
    step.conditionType,
    step.conditionValue
  );

  log(`Condition ${step.conditionType} = ${conditionMet}`);

  // Determine next step based on condition result
  const nextStepId = conditionMet ? step.trueNextStepId : step.falseNextStepId;
  
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
    const updatedInstance = await moveToStep(instance.instanceId, nextStep, triggeredBy, 'branched');
    await executeStep(updatedInstance, pipeline, nextStep, triggeredBy, log);
  } else {
    log(`Decision step has no valid next step for outcome ${conditionMet} (nextStepId: ${nextStepId})`);
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
async function advanceToStep(
  instance: PipelineInstance,
  pipeline: PipelineDefinition,
  fromStep: PipelineStep,
  toStep: PipelineStep,
  triggeredBy: string,
  outcome: 'completed' | 'approved' | 'rejected' | 'branched' | undefined,
  log: (...args: unknown[]) => void
): Promise<void> {
  log(`Advancing from ${fromStep.id} to ${toStep.id}`);

  // Move to the new step
  const updatedInstance = await moveToStep(instance.instanceId, toStep, triggeredBy, outcome);

  // Execute the new step
  await executeStep(updatedInstance, pipeline, toStep, triggeredBy, log);
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

