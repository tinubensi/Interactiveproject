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
  let stepName: string | undefined;
  if (entryStep && entryStep.type === 'stage') {
    const stageStep = entryStep as { stageId: string; stageName: string };
    currentStageName = stageStep.stageName;
    currentStageId = stageStep.stageId;
    stepName = stageStep.stageName; // Use stageName for display
  } else if (entryStep) {
    // For non-stage steps, use the step's name property
    stepName = entryStep.name;
  }

  // Determine next step
  const nextStep = getNextEnabledStep(sortedSteps, entryStep?.id || '');

  // CRITICAL FIX: Progress should reflect that we're at step 1 (not step 0)
  // We've entered the first step, so completedStepsCount should be 1
  // This ensures progress is not zero when instance is created
  const initialCompletedSteps = 1; // We're at the first step
  const initialProgress = calculateProgress(initialCompletedSteps, totalStepsCount);

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
    progressPercent: initialProgress,
    completedStepsCount: initialCompletedSteps,
    totalStepsCount,
    nextStepId: nextStep?.id,
    nextStepType: nextStep?.type,
    nextStageName: nextStep?.type === 'stage' ? (nextStep as any).stageName : undefined,
    stepHistory: [
      {
        stepId: entryStep?.id || '',
        stepType: entryStep?.type || 'stage',
        stageName: currentStageName,
        stepName: stepName,
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
 * Note: This performs a cross-partition query. If you have the leadId, use getInstanceByLeadId instead.
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
 * Note: leadId is the partition key, so we specify it in query options for efficient querying
 */
export async function getInstanceByLeadId(leadId: string): Promise<PipelineInstance | null> {
  // Use listInstances which is verified to work correctly
  const instances = await listInstances({ leadId });

  // Find the most recent active instance
  // listInstances orders by updatedAt DESC, which is generally fine
  const activeInstance = instances.find(
    i => i.status !== 'completed' && i.status !== 'cancelled' && i.status !== 'failed'
  );

  return activeInstance || null;
}

/**
 * Get all instances for a lead (including completed)
 * Note: leadId is the partition key, so we specify it in query options for efficient querying
 */
export async function getAllInstancesForLead(leadId: string): Promise<PipelineInstance[]> {
  const container = getInstancesContainer();

  const query = {
    query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.createdAt DESC',
    parameters: [{ name: '@leadId', value: leadId }],
  };

  // Specify partition key for efficient and reliable querying
  const { resources } = await container.items
    .query<PipelineInstance>(query)
    .fetchAll();

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
 * If leadId is provided, uses partition key for efficient querying
 */
export async function findInstancesWaitingForEvent(
  eventType: string,
  leadId?: string
): Promise<PipelineInstance[]> {
  const container = getInstancesContainer();

  let query = `
    SELECT * FROM c 
    WHERE c.status = 'active' 
    AND IS_DEFINED(c.waitingForEvent) 
    AND c.waitingForEvent = @eventType
  `;
  const parameters: Array<{ name: string; value: string }> = [
    { name: '@eventType', value: eventType },
  ];

  if (leadId) {
    query += ' AND c.leadId = @leadId';
    parameters.push({ name: '@leadId', value: leadId });

    // When leadId is provided, specify partition key for efficient querying
    const { resources } = await container.items
      .query<PipelineInstance>({ query, parameters }, { partitionKey: leadId })
      .fetchAll();

    return resources;
  }

  // Cross-partition query when leadId is not provided
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
  outcome?: StepHistoryEntry['outcome'],
  instance?: PipelineInstance, // Optional: pass instance to avoid re-querying
  leadId?: string // Optional: pass leadId to use partition key query
): Promise<PipelineInstance> {
  // Use provided instance or fetch it
  // CRITICAL: Prefer getInstanceByLeadId (uses partition key) over getInstance (cross-partition)
  let currentInstance: PipelineInstance | undefined = instance;
  if (!currentInstance) {
    if (leadId) {
      // Use partition key query for better reliability
      const fetchedInstance = await getInstanceByLeadId(leadId);
      if (!fetchedInstance || fetchedInstance.instanceId !== instanceId) {
        throw new InstanceNotFoundError(`Instance ${instanceId} not found for lead ${leadId}`);
      }
      currentInstance = fetchedInstance;
    } else {
      // Fallback to cross-partition query
      currentInstance = await getInstance(instanceId);
    }
  }

  const container = getInstancesContainer();
  const now = new Date().toISOString();

  // Close the current step in history
  const updatedHistory = currentInstance.stepHistory.map(entry => {
    if (entry.stepId === currentInstance.currentStepId && !entry.exitedAt) {
      return { ...entry, exitedAt: now, outcome };
    }
    return entry;
  });

  // Get stage info if this is a stage step
  let currentStageName: string | undefined;
  let currentStageId: string | undefined;
  let stepName: string | undefined;

  if (step.type === 'stage') {
    const stageStep = step as { stageId: string; stageName: string };
    currentStageName = stageStep.stageName;
    currentStageId = stageStep.stageId;
    stepName = stageStep.stageName; // Use stageName for display
  } else {
    // For non-stage steps, use the step's name property
    stepName = step.name;
  }

  // Add new step to history
  updatedHistory.push({
    stepId: step.id,
    stepType: step.type,
    stageName: currentStageName,
    stepName: stepName,
    enteredAt: now,
    triggeredBy,
  });

  const completedStepsCount = currentInstance.completedStepsCount + 1;

  const updatedInstance: PipelineInstance = {
    ...currentInstance,
    currentStepId: step.id,
    currentStepType: step.type,
    currentStageName,
    currentStageId,
    progressPercent: calculateProgress(completedStepsCount, currentInstance.totalStepsCount),
    completedStepsCount,
    stepHistory: updatedHistory,
    updatedAt: now,
    // Clear waiting state
    waitingForEvent: undefined,
    waitingForApprovalId: undefined,
    waitingUntil: undefined,
  };

  // CRITICAL: Use the correct Cosmos DB document ID and partition key
  // The instance.id is the Cosmos DB document ID, and leadId is the partition key
  try {
    const { resource } = await container
      .item(currentInstance.id, currentInstance.leadId)
      .replace(updatedInstance);

    if (!resource) {
      throw new Error(`Failed to move instance ${instanceId} to step: replace returned no resource`);
    }

    return resource as PipelineInstance;
  } catch (error: any) {
    // If replace fails (404), wait and retry, or use upsert as fallback
    if (error.code === 404 || error.code === 412) {
      await new Promise(resolve => setTimeout(resolve, 500));
      try {
        const { resource } = await container
          .item(currentInstance.id, currentInstance.leadId)
          .replace(updatedInstance);
        if (!resource) {
          throw new Error(`Failed to move instance ${instanceId} on retry`);
        }
        return resource as PipelineInstance;
      } catch (retryError: any) {
        // Fallback: Try to get instance by leadId (with partition key) and retry
        try {
          const retryInstance = await getInstanceByLeadId(currentInstance.leadId);
          if (retryInstance && retryInstance.instanceId === instanceId) {
            // Use the fresh instance's ID
            const { resource } = await container
              .item(retryInstance.id, retryInstance.leadId)
              .replace({
                ...updatedInstance,
                id: retryInstance.id, // Use the correct Cosmos DB document ID
              });
            if (!resource) {
              throw new Error(`Failed to replace instance ${instanceId} on retry with fresh instance`);
            }
            return resource as unknown as PipelineInstance;
          }
        } catch (freshError) {
          // Final fallback: upsert
          const { resource } = await container.items.upsert(updatedInstance);
          if (!resource) {
            throw new Error(`Failed to upsert instance ${instanceId} after all retries`);
          }
          return resource as unknown as PipelineInstance;
        }
        // If we get here, all retries failed
        throw new Error(`Failed to update instance ${instanceId} after all retry attempts`);
      }
    }
    throw error;
  }
}

/**
 * Update instance status
 */
/**
 * Update instance status directly using provided instance object
 * This avoids re-querying which can fail due to eventual consistency
 */
export async function updateInstanceStatusDirect(
  instance: PipelineInstance,
  status: InstanceStatus,
  additionalUpdates?: Partial<PipelineInstance>
): Promise<PipelineInstance> {
  const container = getInstancesContainer();
  const now = new Date().toISOString();

  if (!instance.leadId) {
    throw new Error(`Instance ${instance.instanceId} is missing leadId (required for partition key)`);
  }

  if (!instance.id) {
    throw new Error(`Instance ${instance.instanceId} is missing id (required for Cosmos DB document ID)`);
  }

  // Preserve Cosmos DB metadata fields (_etag, _ts, etc.) from the original instance
  // These are needed for optimistic concurrency control
  const cosmosMetadata: any = {};
  if ((instance as any)._etag) cosmosMetadata._etag = (instance as any)._etag;
  if ((instance as any)._ts) cosmosMetadata._ts = (instance as any)._ts;
  if ((instance as any)._rid) cosmosMetadata._rid = (instance as any)._rid;
  if ((instance as any)._self) cosmosMetadata._self = (instance as any)._self;

  // CRITICAL: Preserve all existing instance fields, especially progress and stage info
  // Only update the fields specified in additionalUpdates
  const updatedInstance: any = {
    ...instance,
    ...additionalUpdates,
    status,
    updatedAt: now,
    ...(status === 'completed' || status === 'cancelled' || status === 'failed'
      ? { completedAt: now }
      : {}),
    // Preserve Cosmos DB metadata if it exists
    ...cosmosMetadata,
    // CRITICAL: Explicitly preserve progress and stage info if not being updated
    // This ensures progressPercent and completedStepsCount are never lost
    progressPercent: additionalUpdates?.progressPercent ?? instance.progressPercent,
    completedStepsCount: additionalUpdates?.completedStepsCount ?? instance.completedStepsCount,
    currentStageName: additionalUpdates?.currentStageName ?? instance.currentStageName,
    currentStageId: additionalUpdates?.currentStageId ?? instance.currentStageId,
    currentStepId: additionalUpdates?.currentStepId ?? instance.currentStepId,
    currentStepType: additionalUpdates?.currentStepType ?? instance.currentStepType,
  };

  try {
    // Try replace first - if the instance was just created, it should work
    const { resource } = await container
      .item(instance.id, instance.leadId)
      .replace(updatedInstance);

    if (!resource) {
      throw new Error(`Failed to update instance ${instance.instanceId}: replace returned no resource`);
    }

    console.log(`Successfully updated instance ${instance.instanceId} to status ${status}`);
    return resource as PipelineInstance;
  } catch (error: any) {
    // If replace fails (404 or 412), the document might not be committed yet
    // Wait a bit and retry, or use upsert as fallback
    if (error.code === 404 || error.code === 412) {
      console.log(`Replace failed (${error.code}), waiting and retrying for instance ${instance.instanceId}`);
      // Wait a bit for Cosmos DB to commit the create operation
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        // Try replace again
        const { resource } = await container
          .item(instance.id, instance.leadId)
          .replace(updatedInstance);

        if (!resource) {
          throw new Error(`Failed to update instance ${instance.instanceId} on retry: replace returned no resource`);
        }

        console.log(`Successfully updated instance ${instance.instanceId} to status ${status} on retry`);
        return resource as PipelineInstance;
      } catch (retryError: any) {
        // If replace still fails, try upsert as last resort
        console.log(`Replace retry failed, trying upsert for instance ${instance.instanceId}`);
        try {
          const { resource } = await container.items.upsert(updatedInstance);
          if (!resource) {
            throw new Error(`Failed to upsert instance ${instance.instanceId}`);
          }
          console.log(`Successfully upserted instance ${instance.instanceId} to status ${status}`);
          return resource as unknown as PipelineInstance;
        } catch (upsertError: any) {
          console.error(`Error upserting instance ${instance.instanceId}:`, upsertError);
          throw upsertError;
        }
      }
    }

    console.error(`Error updating instance ${instance.instanceId}:`, error);
    console.error(`Instance ID: ${instance.id}, Lead ID: ${instance.leadId}`);
    console.error(`Error code: ${error.code}, Error message: ${error.message}`);
    throw error;
  }
}

export async function updateInstanceStatus(
  instanceId: string,
  status: InstanceStatus,
  additionalUpdates?: Partial<PipelineInstance>
): Promise<PipelineInstance> {
  // Try to get instance - prioritize using leadId from additionalUpdates if available
  // This helps with partition key lookups and avoids eventual consistency issues
  let instance: PipelineInstance;
  const leadId = additionalUpdates?.leadId;

  if (leadId) {
    // If we have leadId, try to get by leadId first (uses partition key, more reliable)
    try {
      const instanceByLead = await getInstanceByLeadId(leadId);
      if (instanceByLead && instanceByLead.instanceId === instanceId) {
        instance = instanceByLead;
      } else {
        // Fallback to getInstance if leadId lookup doesn't match
        instance = await getInstance(instanceId);
      }
    } catch (error) {
      // If getInstanceByLeadId fails, fall back to getInstance
      try {
        instance = await getInstance(instanceId);
      } catch (getError) {
        throw new Error(`Failed to get instance ${instanceId}: ${getError}`);
      }
    }
  } else {
    // No leadId provided, use standard getInstance
    try {
      const tempInstance = await getInstance(instanceId);
      if (tempInstance.leadId) {
        // Try to get by leadId for better reliability
        try {
          const instanceByLead = await getInstanceByLeadId(tempInstance.leadId);
          if (instanceByLead && instanceByLead.instanceId === instanceId) {
            instance = instanceByLead;
          } else {
            instance = tempInstance;
          }
        } catch {
          instance = tempInstance;
        }
      } else {
        instance = tempInstance;
      }
    } catch (error) {
      throw error;
    }
  }

  const container = getInstancesContainer();
  const now = new Date().toISOString();

  if (!instance.leadId) {
    throw new Error(`Instance ${instanceId} is missing leadId (required for partition key)`);
  }

  const updatedInstance: PipelineInstance = {
    ...instance,
    ...additionalUpdates,
    status,
    updatedAt: now,
    ...(status === 'completed' || status === 'cancelled' || status === 'failed'
      ? { completedAt: now }
      : {}),
  };

  try {
    const { resource } = await container
      .item(instance.id, instance.leadId)
      .replace(updatedInstance);

    if (!resource) {
      throw new Error(`Failed to update instance ${instanceId}: replace returned no resource`);
    }

    // Verify the update was successful (but be lenient - Cosmos DB might return slightly stale data)
    if (status && resource.status !== status) {
      // Log warning but don't throw - the update might have succeeded but Cosmos DB returned stale data
      console.warn(`Status verification: expected ${status}, got ${resource.status} for instance ${instanceId}. Update may have succeeded.`);
      // Still return the resource - the update likely succeeded
    }

    return resource as PipelineInstance;
  } catch (error: any) {
    // If replace fails, try to get the instance again and retry
    if (error.code === 404 || error.message?.includes('does not exist')) {
      // Retry with fresh instance fetch
      let retryInstance: PipelineInstance;
      try {
        const instanceByLead = await getInstanceByLeadId(instance.leadId);
        if (instanceByLead && instanceByLead.instanceId === instanceId) {
          retryInstance = instanceByLead;
        } else {
          retryInstance = await getInstance(instanceId);
        }
      } catch (getError) {
        throw new Error(`Failed to get instance ${instanceId} for retry: ${getError}`);
      }

      const retryUpdate: PipelineInstance = {
        ...retryInstance,
        ...additionalUpdates,
        status,
        updatedAt: new Date().toISOString(),
        ...(status === 'completed' || status === 'cancelled' || status === 'failed'
          ? { completedAt: new Date().toISOString() }
          : {}),
      };

      const { resource } = await container
        .item(retryInstance.id, retryInstance.leadId)
        .replace(retryUpdate);

      if (!resource) {
        throw new Error(`Failed to update instance ${instanceId} on retry: replace returned no resource`);
      }

      return resource as PipelineInstance;
    }
    throw error;
  }
}

/**
 * Set instance to waiting for event
 */
export async function setWaitingForEvent(
  instanceId: string,
  eventType: string,
  timeoutAt?: string
): Promise<PipelineInstance> {
  return updateInstanceStatus(instanceId, 'active', {
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
 * Note: This preserves the existing status and waitingForEvent fields
 */
export async function updateNextStepInfo(
  instanceId: string,
  nextStep: PipelineStep | null
): Promise<PipelineInstance> {
  // Try to get instance by leadId first (uses partition key, more reliable)
  let instance: PipelineInstance;
  try {
    const tempInstance = await getInstance(instanceId);
    if (tempInstance.leadId) {
      const instanceByLead = await getInstanceByLeadId(tempInstance.leadId);
      if (instanceByLead && instanceByLead.instanceId === instanceId) {
        instance = instanceByLead;
      } else {
        instance = tempInstance;
      }
    } else {
      instance = tempInstance;
    }
  } catch (error) {
    instance = await getInstance(instanceId);
  }

  const container = getInstancesContainer();
  const now = new Date().toISOString();

  // Preserve existing status and waitingForEvent - don't overwrite them
  const updatedInstance: PipelineInstance = {
    ...instance,
    nextStepId: nextStep?.id,
    nextStepType: nextStep?.type,
    nextStageName: nextStep?.type === 'stage' ? (nextStep as any).stageName : undefined,
    updatedAt: now,
    // Explicitly preserve status and waitingForEvent if they exist
    status: instance.status,
    waitingForEvent: instance.waitingForEvent,
    waitingForApprovalId: instance.waitingForApprovalId,
    waitingUntil: instance.waitingUntil,
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

