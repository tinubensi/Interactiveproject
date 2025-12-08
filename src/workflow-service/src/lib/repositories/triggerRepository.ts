/**
 * Trigger Repository
 * 
 * Manages workflow trigger registrations for event-based workflow execution.
 * Triggers are stored with eventType as partition key for efficient lookup.
 */

import { v4 as uuidv4 } from 'uuid';
import { getCosmosContainers } from '../cosmosClient';
import {
  WorkflowTrigger,
  WorkflowDefinition,
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
 * Register a workflow trigger for an event type
 */
export const registerTrigger = async (
  workflowId: string,
  workflowVersion: number,
  organizationId: string,
  trigger: TriggerDefinition
): Promise<WorkflowTrigger> => {
  if (trigger.type !== 'event') {
    throw new Error('Only event triggers can be registered');
  }

  const containers = await getCosmosContainers();
  const config = trigger.config as EventTriggerConfig;
  const now = new Date().toISOString();

  const workflowTrigger: WorkflowTrigger = {
    id: `${workflowId}-${trigger.id}`,
    triggerId: trigger.id,
    eventType: config.eventType,
    workflowId,
    workflowVersion,
    organizationId,
    isActive: trigger.isActive !== false,
    eventFilter: config.eventFilter,
    extractVariables: config.extractVariables,
    priority: 0,
    createdAt: now
  };

  const { resource } = await containers.workflowTriggers.items.upsert(workflowTrigger);
  return (resource ?? workflowTrigger) as WorkflowTrigger;
};

/**
 * Register all event triggers from a workflow definition
 */
export const registerWorkflowTriggers = async (
  workflow: WorkflowDefinition
): Promise<WorkflowTrigger[]> => {
  const eventTriggers = workflow.triggers.filter(t => t.type === 'event');
  
  const results: WorkflowTrigger[] = [];
  for (const trigger of eventTriggers) {
    const registered = await registerTrigger(
      workflow.workflowId,
      workflow.version,
      workflow.organizationId,
      trigger
    );
    results.push(registered);
  }
  
  return results;
};

/**
 * Deactivate all triggers for a workflow
 */
export const deactivateWorkflowTriggers = async (
  workflowId: string
): Promise<void> => {
  const containers = await getCosmosContainers();
  
  // Find all triggers for this workflow
  const query = {
    query: 'SELECT * FROM c WHERE c.workflowId = @workflowId',
    parameters: [{ name: '@workflowId', value: workflowId }]
  };

  const { resources: triggers } = await containers.workflowTriggers.items
    .query<WorkflowTrigger>(query)
    .fetchAll();

  // Deactivate each trigger
  for (const trigger of triggers) {
    await containers.workflowTriggers.items.upsert({
      ...trigger,
      isActive: false,
      updatedAt: new Date().toISOString()
    });
  }
};

/**
 * Deactivate a specific trigger
 */
export const deactivateTrigger = async (
  triggerId: string,
  eventType: string
): Promise<void> => {
  const containers = await getCosmosContainers();
  
  const { resource: trigger } = await containers.workflowTriggers
    .item(triggerId, eventType)
    .read<WorkflowTrigger>();

  if (!trigger) {
    throw new TriggerNotFoundError(triggerId);
  }

  await containers.workflowTriggers.items.upsert({
    ...trigger,
    isActive: false,
    updatedAt: new Date().toISOString()
  });
};

/**
 * Get all active triggers for a specific event type
 * Used by the event handler to find workflows to execute
 */
export const getActiveTriggersForEvent = async (
  eventType: string
): Promise<WorkflowTrigger[]> => {
  const containers = await getCosmosContainers();

  const query = {
    query: `
      SELECT * FROM c 
      WHERE c.eventType = @eventType 
      AND c.isActive = true
      ORDER BY c.priority DESC
    `,
    parameters: [{ name: '@eventType', value: eventType }]
  };

  const { resources } = await containers.workflowTriggers.items
    .query<WorkflowTrigger>(query)
    .fetchAll();

  return resources;
};

/**
 * Get all triggers for a workflow
 */
export const getTriggersForWorkflow = async (
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
 * Delete all triggers for a workflow
 */
export const deleteWorkflowTriggers = async (
  workflowId: string
): Promise<void> => {
  const triggers = await getTriggersForWorkflow(workflowId);
  const containers = await getCosmosContainers();

  for (const trigger of triggers) {
    await containers.workflowTriggers
      .item(trigger.id, trigger.eventType)
      .delete();
  }
};

/**
 * Evaluate if an event matches a trigger's filter
 * Supports simple JSONPath-like expressions
 */
export const evaluateEventFilter = (
  eventData: Record<string, unknown>,
  filter?: string
): boolean => {
  if (!filter) {
    return true; // No filter means match all
  }

  try {
    // Simple expression evaluation
    // Supports: data.field == "value", data.field != "value", data.field > number
    const parts = filter.match(/^([a-zA-Z.]+)\s*(==|!=|>|<|>=|<=)\s*(.+)$/);
    if (!parts) {
      console.warn(`Invalid filter expression: ${filter}`);
      return true; // Default to matching if filter is invalid
    }

    const [, path, operator, rawValue] = parts;
    
    // Get value from event data using path
    const pathParts = path.split('.');
    let value: unknown = eventData;
    for (const part of pathParts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }

    // Parse the comparison value
    let compareValue: unknown;
    const trimmedValue = rawValue.trim();
    if (trimmedValue.startsWith('"') && trimmedValue.endsWith('"')) {
      compareValue = trimmedValue.slice(1, -1);
    } else if (trimmedValue.startsWith("'") && trimmedValue.endsWith("'")) {
      compareValue = trimmedValue.slice(1, -1);
    } else if (trimmedValue === 'true') {
      compareValue = true;
    } else if (trimmedValue === 'false') {
      compareValue = false;
    } else if (trimmedValue === 'null') {
      compareValue = null;
    } else if (!isNaN(Number(trimmedValue))) {
      compareValue = Number(trimmedValue);
    } else {
      compareValue = trimmedValue;
    }

    // Perform comparison
    switch (operator) {
      case '==':
        return value === compareValue;
      case '!=':
        return value !== compareValue;
      case '>':
        return Number(value) > Number(compareValue);
      case '<':
        return Number(value) < Number(compareValue);
      case '>=':
        return Number(value) >= Number(compareValue);
      case '<=':
        return Number(value) <= Number(compareValue);
      default:
        return true;
    }
  } catch (error) {
    console.error('Error evaluating event filter:', error);
    return true; // Default to matching on error
  }
};

/**
 * Extract variables from event data using mapping
 */
export const extractVariablesFromEvent = (
  eventData: Record<string, unknown>,
  extractVariables?: Record<string, string>
): Record<string, unknown> => {
  if (!extractVariables) {
    return {};
  }

  const result: Record<string, unknown> = {};

  for (const [varName, path] of Object.entries(extractVariables)) {
    // Handle JSONPath-like expressions: $.data.leadId
    const cleanPath = path.startsWith('$.') ? path.slice(2) : path;
    const pathParts = cleanPath.split('.');
    
    let value: unknown = eventData;
    for (const part of pathParts) {
      if (value && typeof value === 'object') {
        value = (value as Record<string, unknown>)[part];
      } else {
        value = undefined;
        break;
      }
    }
    
    if (value !== undefined) {
      result[varName] = value;
    }
  }

  return result;
};
