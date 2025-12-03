import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import { getConfig } from '../config';
import {
  WorkflowInstance,
  InstanceStatus,
  InstanceFilters,
  StepExecution,
  TriggerType
} from '../../models/workflowTypes';

export class InstanceNotFoundError extends Error {
  constructor(instanceId: string) {
    super(`Workflow instance ${instanceId} not found`);
    this.name = 'InstanceNotFoundError';
  }
}

export interface CreateInstanceParams {
  workflowId: string;
  workflowVersion: number;
  workflowName: string;
  organizationId: string;
  triggerId: string;
  triggerType: TriggerType;
  triggerData?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  correlationId?: string;
  parentInstanceId?: string;
  initiatedBy?: string;
}

/**
 * Create a new workflow instance
 */
export const createInstance = async (
  params: CreateInstanceParams
): Promise<WorkflowInstance> => {
  const containers = await getCosmosContainers();
  const config = getConfig();
  const instanceId = `inst-${uuidv4().slice(0, 12)}`;
  const now = new Date().toISOString();

  const instance: WorkflowInstance = {
    id: instanceId,
    instanceId,
    workflowId: params.workflowId,
    workflowVersion: params.workflowVersion,
    workflowName: params.workflowName,
    organizationId: params.organizationId,
    triggerId: params.triggerId,
    triggerType: params.triggerType,
    triggerData: params.triggerData,
    status: 'pending',
    stepExecutions: [],
    variables: params.variables || {},
    completedStepIds: [],
    correlationId: params.correlationId,
    parentInstanceId: params.parentInstanceId,
    createdAt: now,
    initiatedBy: params.initiatedBy,
    ttl: config.settings.instanceTtlSeconds
  };

  const { resource } = await containers.workflowInstances.items.create(instance);
  return resource as WorkflowInstance;
};

/**
 * Get a workflow instance by ID
 */
export const getInstance = async (
  instanceId: string
): Promise<WorkflowInstance> => {
  const containers = await getCosmosContainers();

  const query = {
    query: 'SELECT * FROM c WHERE c.instanceId = @instanceId',
    parameters: [{ name: '@instanceId', value: instanceId }]
  };

  const { resources } = await containers.workflowInstances.items
    .query<WorkflowInstance>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new InstanceNotFoundError(instanceId);
  }

  return resources[0];
};

/**
 * Update a workflow instance
 */
export const updateInstance = async (
  instanceId: string,
  updates: Partial<WorkflowInstance>
): Promise<WorkflowInstance> => {
  const containers = await getCosmosContainers();
  const current = await getInstance(instanceId);

  const updated: WorkflowInstance = {
    ...current,
    ...updates,
    instanceId: current.instanceId // Ensure instanceId is not overwritten
  };

  await containers.workflowInstances.items.upsert(updated);
  return updated;
};

/**
 * Update instance status
 */
export const updateInstanceStatus = async (
  instanceId: string,
  status: InstanceStatus,
  additionalUpdates?: Partial<WorkflowInstance>
): Promise<WorkflowInstance> => {
  const updates: Partial<WorkflowInstance> = {
    status,
    ...additionalUpdates
  };

  if (status === 'running' && !additionalUpdates?.startedAt) {
    updates.startedAt = new Date().toISOString();
  }

  if (
    ['completed', 'failed', 'cancelled', 'timed_out'].includes(status) &&
    !additionalUpdates?.completedAt
  ) {
    updates.completedAt = new Date().toISOString();
  }

  return updateInstance(instanceId, updates);
};

/**
 * Update the current step being executed
 */
export const updateCurrentStep = async (
  instanceId: string,
  stepId: string,
  stepExecution: StepExecution
): Promise<WorkflowInstance> => {
  const current = await getInstance(instanceId);

  // Update or add step execution
  const existingIndex = current.stepExecutions.findIndex(
    (s) => s.stepId === stepId
  );

  const updatedExecutions = [...current.stepExecutions];
  if (existingIndex >= 0) {
    updatedExecutions[existingIndex] = stepExecution;
  } else {
    updatedExecutions.push(stepExecution);
  }

  // Update completed steps if step is completed
  let completedStepIds = current.completedStepIds;
  if (stepExecution.status === 'completed') {
    completedStepIds = [...new Set([...completedStepIds, stepId])];
  }

  return updateInstance(instanceId, {
    currentStepId: stepId,
    stepExecutions: updatedExecutions,
    completedStepIds
  });
};

/**
 * Update workflow variables
 */
export const updateVariables = async (
  instanceId: string,
  variableUpdates: Record<string, unknown>
): Promise<WorkflowInstance> => {
  const current = await getInstance(instanceId);

  return updateInstance(instanceId, {
    variables: {
      ...current.variables,
      ...variableUpdates
    }
  });
};

/**
 * List workflow instances with filters
 */
export const listInstances = async (
  filters?: InstanceFilters
): Promise<WorkflowInstance[]> => {
  const containers = await getCosmosContainers();

  let query = 'SELECT * FROM c WHERE 1=1';
  const parameters: Array<{ name: string; value: string | string[] }> = [];

  if (filters?.workflowId) {
    query += ' AND c.workflowId = @workflowId';
    parameters.push({ name: '@workflowId', value: filters.workflowId });
  }

  if (filters?.organizationId) {
    query += ' AND c.organizationId = @organizationId';
    parameters.push({ name: '@organizationId', value: filters.organizationId });
  }

  if (filters?.status) {
    if (Array.isArray(filters.status)) {
      query += ` AND c.status IN (${filters.status.map((_, i) => `@status${i}`).join(',')})`;
      filters.status.forEach((s, i) => {
        parameters.push({ name: `@status${i}`, value: s });
      });
    } else {
      query += ' AND c.status = @status';
      parameters.push({ name: '@status', value: filters.status });
    }
  }

  if (filters?.correlationId) {
    query += ' AND c.correlationId = @correlationId';
    parameters.push({ name: '@correlationId', value: filters.correlationId });
  }

  if (filters?.initiatedBy) {
    query += ' AND c.initiatedBy = @initiatedBy';
    parameters.push({ name: '@initiatedBy', value: filters.initiatedBy });
  }

  if (filters?.startDateFrom) {
    query += ' AND c.createdAt >= @startDateFrom';
    parameters.push({ name: '@startDateFrom', value: filters.startDateFrom });
  }

  if (filters?.startDateTo) {
    query += ' AND c.createdAt <= @startDateTo';
    parameters.push({ name: '@startDateTo', value: filters.startDateTo });
  }

  query += ' ORDER BY c.createdAt DESC';

  const { resources } = await containers.workflowInstances.items
    .query<WorkflowInstance>({ query, parameters })
    .fetchAll();

  return resources;
};

/**
 * Get step execution logs for an instance
 */
export const getInstanceLogs = async (
  instanceId: string
): Promise<StepExecution[]> => {
  const instance = await getInstance(instanceId);
  return instance.stepExecutions;
};

/**
 * Cancel a running instance
 */
export const cancelInstance = async (
  instanceId: string,
  userId: string,
  reason?: string
): Promise<WorkflowInstance> => {
  const instance = await getInstance(instanceId);

  if (!['pending', 'running', 'waiting', 'paused'].includes(instance.status)) {
    throw new Error(
      `Cannot cancel instance with status ${instance.status}`
    );
  }

  return updateInstanceStatus(instanceId, 'cancelled', {
    lastError: {
      stepId: instance.currentStepId || '',
      code: 'CANCELLED',
      message: reason || `Cancelled by ${userId}`,
      timestamp: new Date().toISOString()
    }
  });
};

/**
 * Pause a running instance
 */
export const pauseInstance = async (
  instanceId: string
): Promise<WorkflowInstance> => {
  const instance = await getInstance(instanceId);

  if (instance.status !== 'running') {
    throw new Error(
      `Cannot pause instance with status ${instance.status}`
    );
  }

  return updateInstanceStatus(instanceId, 'paused');
};

/**
 * Resume a paused instance
 */
export const resumeInstance = async (
  instanceId: string
): Promise<WorkflowInstance> => {
  const instance = await getInstance(instanceId);

  if (instance.status !== 'paused') {
    throw new Error(
      `Cannot resume instance with status ${instance.status}`
    );
  }

  return updateInstanceStatus(instanceId, 'running');
};

/**
 * Get child instances of a parent instance
 */
export const getChildInstances = async (
  parentInstanceId: string
): Promise<WorkflowInstance[]> => {
  const containers = await getCosmosContainers();

  const query = {
    query: 'SELECT * FROM c WHERE c.parentInstanceId = @parentInstanceId ORDER BY c.createdAt DESC',
    parameters: [{ name: '@parentInstanceId', value: parentInstanceId }]
  };

  const { resources } = await containers.workflowInstances.items
    .query<WorkflowInstance>(query)
    .fetchAll();

  return resources;
};

/**
 * Get instance statistics for a workflow
 */
export const getInstanceStats = async (
  workflowId: string,
  organizationId: string
): Promise<Record<InstanceStatus, number>> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT c.status, COUNT(1) as count 
      FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.organizationId = @organizationId
      GROUP BY c.status
    `,
    parameters: [
      { name: '@workflowId', value: workflowId },
      { name: '@organizationId', value: organizationId }
    ]
  };

  const { resources } = await containers.workflowInstances.items
    .query<{ status: InstanceStatus; count: number }>(query)
    .fetchAll();

  const stats: Record<string, number> = {};
  for (const resource of resources) {
    stats[resource.status] = resource.count;
  }

  return stats as Record<InstanceStatus, number>;
};

