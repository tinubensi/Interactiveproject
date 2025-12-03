import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import {
  WorkflowTrigger,
  TriggerDefinition,
  EventTriggerConfig
} from '../../models/workflowTypes';

export class TriggerNotFoundError extends Error {
  constructor(triggerId: string) {
    super(`Trigger ${triggerId} not found`);
    this.name = 'TriggerNotFoundError';
  }
}

/**
 * Register a workflow trigger
 */
export const registerTrigger = async (
  workflowId: string,
  workflowVersion: number,
  organizationId: string,
  trigger: TriggerDefinition
): Promise<WorkflowTrigger> => {
  const containers = await getCosmosContainers();

  // Only register event triggers in the trigger registry
  if (trigger.type !== 'event') {
    throw new Error('Only event triggers can be registered in the trigger registry');
  }

  const eventConfig = trigger.config as EventTriggerConfig;
  const triggerId = `trigger-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const workflowTrigger: WorkflowTrigger = {
    id: triggerId,
    triggerId,
    eventType: eventConfig.eventType,
    workflowId,
    workflowVersion,
    organizationId,
    isActive: trigger.isActive !== false,
    eventFilter: eventConfig.eventFilter,
    extractVariables: eventConfig.extractVariables,
    priority: 100,
    createdAt: now
  };

  const { resource } = await containers.workflowTriggers.items.create(
    workflowTrigger
  );
  return resource as WorkflowTrigger;
};

/**
 * Unregister a trigger
 */
export const unregisterTrigger = async (
  triggerId: string
): Promise<void> => {
  const containers = await getCosmosContainers();
  const trigger = await getTrigger(triggerId);

  await containers.workflowTriggers
    .item(trigger.id, trigger.eventType)
    .delete();
};

/**
 * Get a trigger by ID
 */
export const getTrigger = async (
  triggerId: string
): Promise<WorkflowTrigger> => {
  const containers = await getCosmosContainers();

  const query = {
    query: 'SELECT * FROM c WHERE c.triggerId = @triggerId',
    parameters: [{ name: '@triggerId', value: triggerId }]
  };

  const { resources } = await containers.workflowTriggers.items
    .query<WorkflowTrigger>(query)
    .fetchAll();

  if (resources.length === 0) {
    throw new TriggerNotFoundError(triggerId);
  }

  return resources[0];
};

/**
 * Find all triggers for a specific event type
 */
export const findTriggersForEvent = async (
  eventType: string
): Promise<WorkflowTrigger[]> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.eventType = @eventType 
      AND c.isActive = true
      ORDER BY c.priority ASC
    `,
    parameters: [{ name: '@eventType', value: eventType }]
  };

  const { resources } = await containers.workflowTriggers.items
    .query<WorkflowTrigger>(query)
    .fetchAll();

  return resources;
};

/**
 * Find all triggers for a workflow
 */
export const findTriggersForWorkflow = async (
  workflowId: string
): Promise<WorkflowTrigger[]> => {
  const containers = await getCosmosContainers();

  const query = {
    query: 'SELECT * FROM c WHERE c.workflowId = @workflowId',
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources } = await containers.workflowTriggers.items
    .query<WorkflowTrigger>(query)
    .fetchAll();

  return resources;
};

/**
 * Activate a trigger
 */
export const activateTrigger = async (
  triggerId: string
): Promise<WorkflowTrigger> => {
  const trigger = await getTrigger(triggerId);
  const containers = await getCosmosContainers();

  const updated: WorkflowTrigger = {
    ...trigger,
    isActive: true,
    updatedAt: new Date().toISOString()
  };

  await containers.workflowTriggers.items.upsert(updated);
  return updated;
};

/**
 * Deactivate a trigger
 */
export const deactivateTrigger = async (
  triggerId: string
): Promise<WorkflowTrigger> => {
  const trigger = await getTrigger(triggerId);
  const containers = await getCosmosContainers();

  const updated: WorkflowTrigger = {
    ...trigger,
    isActive: false,
    updatedAt: new Date().toISOString()
  };

  await containers.workflowTriggers.items.upsert(updated);
  return updated;
};

/**
 * Update trigger priority
 */
export const updateTriggerPriority = async (
  triggerId: string,
  priority: number
): Promise<WorkflowTrigger> => {
  const trigger = await getTrigger(triggerId);
  const containers = await getCosmosContainers();

  const updated: WorkflowTrigger = {
    ...trigger,
    priority,
    updatedAt: new Date().toISOString()
  };

  await containers.workflowTriggers.items.upsert(updated);
  return updated;
};

/**
 * Deactivate all triggers for a workflow
 */
export const deactivateWorkflowTriggers = async (
  workflowId: string
): Promise<void> => {
  const triggers = await findTriggersForWorkflow(workflowId);
  const containers = await getCosmosContainers();
  const now = new Date().toISOString();

  for (const trigger of triggers) {
    await containers.workflowTriggers.items.upsert({
      ...trigger,
      isActive: false,
      updatedAt: now
    });
  }
};

/**
 * Delete all triggers for a workflow
 */
export const deleteWorkflowTriggers = async (
  workflowId: string
): Promise<void> => {
  const triggers = await findTriggersForWorkflow(workflowId);
  const containers = await getCosmosContainers();

  for (const trigger of triggers) {
    await containers.workflowTriggers
      .item(trigger.id, trigger.eventType)
      .delete();
  }
};

/**
 * Register triggers for an activated workflow
 */
export const registerWorkflowTriggers = async (
  workflowId: string,
  workflowVersion: number,
  organizationId: string,
  triggers: TriggerDefinition[]
): Promise<WorkflowTrigger[]> => {
  const registeredTriggers: WorkflowTrigger[] = [];

  // First, deactivate existing triggers
  await deactivateWorkflowTriggers(workflowId);

  // Register new triggers
  for (const trigger of triggers) {
    if (trigger.type === 'event') {
      const registered = await registerTrigger(
        workflowId,
        workflowVersion,
        organizationId,
        trigger
      );
      registeredTriggers.push(registered);
    }
  }

  return registeredTriggers;
};

