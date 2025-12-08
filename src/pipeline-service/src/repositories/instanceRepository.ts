/**
 * Instance Repository
 * Data access layer for pipeline instances (per-lead tracking)
 */

import { v4 as uuidv4 } from 'uuid';
import { getInstancesContainer } from '../lib/cosmosClient';
import type {
  PipelineInstance,
  PipelineDefinition,
  PipelineStep,
  StepHistoryEntry,
  InstanceStatus,
  LineOfBusiness,
  StepType,
} from '../models/pipeline';
import { getStageById } from '../constants/predefined';

// =============================================================================
// Error Classes
// =============================================================================

export class InstanceNotFoundError extends Error {
  constructor(identifier: string) {
    super(`Pipeline instance not found: ${identifier}`);
    this.name = 'InstanceNotFoundError';
  }
}

// =============================================================================
// Create Operations
// =============================================================================

/**
 * Create a new pipeline instance for a lead
 */
export async function createInstance(
  pipeline: PipelineDefinition,
  leadId: string,
  triggeredBy: string = 'system'
): Promise<PipelineInstance> {
  const container = getInstancesContainer();
  const now = new Date().toISOString();
  const instanceId = uuidv4();

  // Get the entry step
  const sortedSteps = [...pipeline.steps].sort((a, b) => a.order - b.order);
  const entryStep = sortedSteps.find(s => s.enabled) || sortedSteps[0];

  // Calculate total enabled steps
  const totalStepsCount = pipeline.steps.filter(s => s.enabled).length;

  // Get stage info if entry step is a stage step
  let currentStageName: string | undefined;
  let currentStageId: string | undefined;
  if (entryStep && entryStep.type === 'stage') {
    const stageStep = entryStep as { stageId: string; stageName: string };
    currentStageName = stageStep.stageName;
    currentStageId = stageStep.stageId;
  }

  // Determine next step
  const nextStep = getNextEnabledStep(sortedSteps, entryStep?.id || '');

  const instance: PipelineInstance = {
    id: instanceId,
    instanceId,
    pipelineId: pipeline.pipelineId,
    pipelineVersion: pipeline.version,
    pipelineName: pipeline.name,
    leadId,
    lineOfBusiness: pipeline.lineOfBusiness,
    organizationId: pipeline.organizationId,
    status: 'active',
    currentStepId: entryStep?.id || '',
    currentStepType: entryStep?.type || 'stage',
    currentStageName,
    currentStageId,
    progressPercent: calculateProgress(0, totalStepsCount),
    completedStepsCount: 0,
    totalStepsCount,
    nextStepId: nextStep?.id,
    nextStepType: nextStep?.type,
    nextStageName: nextStep?.type === 'stage' ? (nextStep as any).stageName : undefined,
    stepHistory: [
      {
        stepId: entryStep?.id || '',
        stepType: entryStep?.type || 'stage',
        stageName: currentStageName,
        enteredAt: now,
        triggeredBy,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  const { resource } = await container.items.create(instance);
  return resource as PipelineInstance;
}

// =============================================================================
// Read Operations
// =============================================================================

/**
 * Get an instance by ID
 */
export async function getInstance(instanceId: string): Promise<PipelineInstance> {
  const container = getInstancesContainer();

  const query = {
    query: 'SELECT * FROM c WHERE c.instanceId = @instanceId',
    parameters: [{ name: '@instanceId', value: instanceId }],
  };

  const { resources } = await container.items.query<PipelineInstance>(query).fetchAll();

  if (resources.length === 0) {
    throw new InstanceNotFoundError(instanceId);
  }

  return resources[0];
}

/**
 * Get an instance by lead ID
 */
export async function getInstanceByLeadId(leadId: string): Promise<PipelineInstance | null> {
  const container = getInstancesContainer();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.leadId = @leadId 
      AND c.status NOT IN ('completed', 'cancelled')
      ORDER BY c.createdAt DESC
    `,
    parameters: [{ name: '@leadId', value: leadId }],
  };

  const { resources } = await container.items.query<PipelineInstance>(query).fetchAll();

  return resources.length > 0 ? resources[0] : null;
}

/**
 * Get all instances for a lead (including completed)
 */
export async function getAllInstancesForLead(leadId: string): Promise<PipelineInstance[]> {
  const container = getInstancesContainer();

  const query = {
    query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.createdAt DESC',
    parameters: [{ name: '@leadId', value: leadId }],
  };

  const { resources } = await container.items.query<PipelineInstance>(query).fetchAll();

  return resources;
}

/**
 * List instances with optional filters
 */
export async function listInstances(filters?: {
  pipelineId?: string;
  leadId?: string;
  status?: InstanceStatus;
  lineOfBusiness?: LineOfBusiness;
  organizationId?: string;
}): Promise<PipelineInstance[]> {
  const container = getInstancesContainer();

  let query = 'SELECT * FROM c WHERE 1=1';
  const parameters: Array<{ name: string; value: string }> = [];

  if (filters?.pipelineId) {
    query += ' AND c.pipelineId = @pipelineId';
    parameters.push({ name: '@pipelineId', value: filters.pipelineId });
  }

  if (filters?.leadId) {
    query += ' AND c.leadId = @leadId';
    parameters.push({ name: '@leadId', value: filters.leadId });
  }

  if (filters?.status) {
    query += ' AND c.status = @status';
    parameters.push({ name: '@status', value: filters.status });
  }

  if (filters?.lineOfBusiness) {
    query += ' AND c.lineOfBusiness = @lineOfBusiness';
    parameters.push({ name: '@lineOfBusiness', value: filters.lineOfBusiness });
  }

  if (filters?.organizationId) {
    query += ' AND c.organizationId = @organizationId';
    parameters.push({ name: '@organizationId', value: filters.organizationId });
  }

  query += ' ORDER BY c.updatedAt DESC';

  const { resources } = await container.items
    .query<PipelineInstance>({ query, parameters })
    .fetchAll();

  return resources;
}

/**
 * Find instances waiting for a specific event
 */
export async function findInstancesWaitingForEvent(
  eventType: string,
  leadId?: string
): Promise<PipelineInstance[]> {
  const container = getInstancesContainer();

  let query = `
    SELECT * FROM c 
    WHERE c.status = 'waiting_event' 
    AND c.waitingForEvent = @eventType
  `;
  const parameters: Array<{ name: string; value: string }> = [
    { name: '@eventType', value: eventType },
  ];

  if (leadId) {
    query += ' AND c.leadId = @leadId';
    parameters.push({ name: '@leadId', value: leadId });
  }

  const { resources } = await container.items
    .query<PipelineInstance>({ query, parameters })
    .fetchAll();

  return resources;
}

// =============================================================================
// Update Operations
// =============================================================================

/**
 * Move instance to the next step
 */
export async function moveToStep(
  instanceId: string,
  step: PipelineStep,
  triggeredBy: string,
  outcome?: StepHistoryEntry['outcome']
): Promise<PipelineInstance> {
  const instance = await getInstance(instanceId);
  const container = getInstancesContainer();
  const now = new Date().toISOString();

  // Close the current step in history
  const updatedHistory = instance.stepHistory.map(entry => {
    if (entry.stepId === instance.currentStepId && !entry.exitedAt) {
      return { ...entry, exitedAt: now, outcome };
    }
    return entry;
  });

  // Get stage info if this is a stage step
  let currentStageName: string | undefined;
  let currentStageId: string | undefined;
  if (step.type === 'stage') {
    const stageStep = step as { stageId: string; stageName: string };
    currentStageName = stageStep.stageName;
    currentStageId = stageStep.stageId;
  }

  // Add new step to history
  updatedHistory.push({
    stepId: step.id,
    stepType: step.type,
    stageName: currentStageName,
    enteredAt: now,
    triggeredBy,
  });

  const completedStepsCount = instance.completedStepsCount + 1;

  const updatedInstance: PipelineInstance = {
    ...instance,
    currentStepId: step.id,
    currentStepType: step.type,
    currentStageName,
    currentStageId,
    progressPercent: calculateProgress(completedStepsCount, instance.totalStepsCount),
    completedStepsCount,
    stepHistory: updatedHistory,
    updatedAt: now,
    // Clear waiting state
    waitingForEvent: undefined,
    waitingForApprovalId: undefined,
    waitingUntil: undefined,
  };

  const { resource } = await container
    .item(instance.id, instance.leadId)
    .replace(updatedInstance);

  return resource as PipelineInstance;
}

/**
 * Update instance status
 */
export async function updateInstanceStatus(
  instanceId: string,
  status: InstanceStatus,
  additionalUpdates?: Partial<PipelineInstance>
): Promise<PipelineInstance> {
  const instance = await getInstance(instanceId);
  const container = getInstancesContainer();
  const now = new Date().toISOString();

  const updatedInstance: PipelineInstance = {
    ...instance,
    ...additionalUpdates,
    status,
    updatedAt: now,
    ...(status === 'completed' || status === 'cancelled' || status === 'failed'
      ? { completedAt: now }
      : {}),
  };

  const { resource } = await container
    .item(instance.id, instance.leadId)
    .replace(updatedInstance);

  return resource as PipelineInstance;
}

/**
 * Set instance to waiting for event
 */
export async function setWaitingForEvent(
  instanceId: string,
  eventType: string,
  timeoutAt?: string
): Promise<PipelineInstance> {
  return updateInstanceStatus(instanceId, 'waiting_event', {
    waitingForEvent: eventType,
    waitingUntil: timeoutAt,
  });
}

/**
 * Set instance to waiting for approval
 */
export async function setWaitingForApproval(
  instanceId: string,
  approvalId: string,
  expiresAt?: string
): Promise<PipelineInstance> {
  return updateInstanceStatus(instanceId, 'waiting_approval', {
    waitingForApprovalId: approvalId,
    waitingUntil: expiresAt,
  });
}

/**
 * Update next step info
 */
export async function updateNextStepInfo(
  instanceId: string,
  nextStep: PipelineStep | null
): Promise<PipelineInstance> {
  const instance = await getInstance(instanceId);
  const container = getInstancesContainer();
  const now = new Date().toISOString();

  const updatedInstance: PipelineInstance = {
    ...instance,
    nextStepId: nextStep?.id,
    nextStepType: nextStep?.type,
    nextStageName: nextStep?.type === 'stage' ? (nextStep as any).stageName : undefined,
    updatedAt: now,
  };

  const { resource } = await container
    .item(instance.id, instance.leadId)
    .replace(updatedInstance);

  return resource as PipelineInstance;
}

/**
 * Record an error on the instance
 */
export async function recordError(
  instanceId: string,
  stepId: string,
  message: string
): Promise<PipelineInstance> {
  const instance = await getInstance(instanceId);
  const container = getInstancesContainer();
  const now = new Date().toISOString();

  const updatedInstance: PipelineInstance = {
    ...instance,
    lastError: {
      stepId,
      message,
      timestamp: now,
    },
    status: 'failed',
    updatedAt: now,
    completedAt: now,
  };

  const { resource } = await container
    .item(instance.id, instance.leadId)
    .replace(updatedInstance);

  return resource as PipelineInstance;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Calculate progress percentage
 */
function calculateProgress(completedSteps: number, totalSteps: number): number {
  if (totalSteps === 0) return 0;
  return Math.round((completedSteps / totalSteps) * 100);
}

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
 * Get step history for an instance
 */
export async function getStepHistory(instanceId: string): Promise<StepHistoryEntry[]> {
  const instance = await getInstance(instanceId);
  return instance.stepHistory;
}

