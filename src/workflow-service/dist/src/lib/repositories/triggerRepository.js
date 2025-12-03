"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWorkflowTriggers = exports.deleteWorkflowTriggers = exports.deactivateWorkflowTriggers = exports.updateTriggerPriority = exports.deactivateTrigger = exports.activateTrigger = exports.findTriggersForWorkflow = exports.findTriggersForEvent = exports.getTrigger = exports.unregisterTrigger = exports.registerTrigger = exports.TriggerNotFoundError = void 0;
const uuid_1 = require("uuid");
const cosmosClient_1 = require("../cosmosClient");
class TriggerNotFoundError extends Error {
    constructor(triggerId) {
        super(`Trigger ${triggerId} not found`);
        this.name = 'TriggerNotFoundError';
    }
}
exports.TriggerNotFoundError = TriggerNotFoundError;
/**
 * Register a workflow trigger
 */
const registerTrigger = async (workflowId, workflowVersion, organizationId, trigger) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    // Only register event triggers in the trigger registry
    if (trigger.type !== 'event') {
        throw new Error('Only event triggers can be registered in the trigger registry');
    }
    const eventConfig = trigger.config;
    const triggerId = `trigger-${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const workflowTrigger = {
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
    const { resource } = await containers.workflowTriggers.items.create(workflowTrigger);
    return resource;
};
exports.registerTrigger = registerTrigger;
/**
 * Unregister a trigger
 */
const unregisterTrigger = async (triggerId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const trigger = await (0, exports.getTrigger)(triggerId);
    await containers.workflowTriggers
        .item(trigger.id, trigger.eventType)
        .delete();
};
exports.unregisterTrigger = unregisterTrigger;
/**
 * Get a trigger by ID
 */
const getTrigger = async (triggerId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: 'SELECT * FROM c WHERE c.triggerId = @triggerId',
        parameters: [{ name: '@triggerId', value: triggerId }]
    };
    const { resources } = await containers.workflowTriggers.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new TriggerNotFoundError(triggerId);
    }
    return resources[0];
};
exports.getTrigger = getTrigger;
/**
 * Find all triggers for a specific event type
 */
const findTriggersForEvent = async (eventType) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
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
        .query(query)
        .fetchAll();
    return resources;
};
exports.findTriggersForEvent = findTriggersForEvent;
/**
 * Find all triggers for a workflow
 */
const findTriggersForWorkflow = async (workflowId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: 'SELECT * FROM c WHERE c.workflowId = @workflowId',
        parameters: [{ name: '@workflowId', value: workflowId }]
    };
    const { resources } = await containers.workflowTriggers.items
        .query(query)
        .fetchAll();
    return resources;
};
exports.findTriggersForWorkflow = findTriggersForWorkflow;
/**
 * Activate a trigger
 */
const activateTrigger = async (triggerId) => {
    const trigger = await (0, exports.getTrigger)(triggerId);
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const updated = {
        ...trigger,
        isActive: true,
        updatedAt: new Date().toISOString()
    };
    await containers.workflowTriggers.items.upsert(updated);
    return updated;
};
exports.activateTrigger = activateTrigger;
/**
 * Deactivate a trigger
 */
const deactivateTrigger = async (triggerId) => {
    const trigger = await (0, exports.getTrigger)(triggerId);
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const updated = {
        ...trigger,
        isActive: false,
        updatedAt: new Date().toISOString()
    };
    await containers.workflowTriggers.items.upsert(updated);
    return updated;
};
exports.deactivateTrigger = deactivateTrigger;
/**
 * Update trigger priority
 */
const updateTriggerPriority = async (triggerId, priority) => {
    const trigger = await (0, exports.getTrigger)(triggerId);
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const updated = {
        ...trigger,
        priority,
        updatedAt: new Date().toISOString()
    };
    await containers.workflowTriggers.items.upsert(updated);
    return updated;
};
exports.updateTriggerPriority = updateTriggerPriority;
/**
 * Deactivate all triggers for a workflow
 */
const deactivateWorkflowTriggers = async (workflowId) => {
    const triggers = await (0, exports.findTriggersForWorkflow)(workflowId);
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const now = new Date().toISOString();
    for (const trigger of triggers) {
        await containers.workflowTriggers.items.upsert({
            ...trigger,
            isActive: false,
            updatedAt: now
        });
    }
};
exports.deactivateWorkflowTriggers = deactivateWorkflowTriggers;
/**
 * Delete all triggers for a workflow
 */
const deleteWorkflowTriggers = async (workflowId) => {
    const triggers = await (0, exports.findTriggersForWorkflow)(workflowId);
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    for (const trigger of triggers) {
        await containers.workflowTriggers
            .item(trigger.id, trigger.eventType)
            .delete();
    }
};
exports.deleteWorkflowTriggers = deleteWorkflowTriggers;
/**
 * Register triggers for an activated workflow
 */
const registerWorkflowTriggers = async (workflowId, workflowVersion, organizationId, triggers) => {
    const registeredTriggers = [];
    // First, deactivate existing triggers
    await (0, exports.deactivateWorkflowTriggers)(workflowId);
    // Register new triggers
    for (const trigger of triggers) {
        if (trigger.type === 'event') {
            const registered = await (0, exports.registerTrigger)(workflowId, workflowVersion, organizationId, trigger);
            registeredTriggers.push(registered);
        }
    }
    return registeredTriggers;
};
exports.registerWorkflowTriggers = registerWorkflowTriggers;
//# sourceMappingURL=triggerRepository.js.map