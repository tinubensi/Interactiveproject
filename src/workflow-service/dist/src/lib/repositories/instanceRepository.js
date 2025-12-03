"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInstanceStats = exports.getChildInstances = exports.resumeInstance = exports.pauseInstance = exports.cancelInstance = exports.getInstanceLogs = exports.listInstances = exports.updateVariables = exports.updateCurrentStep = exports.updateInstanceStatus = exports.updateInstance = exports.getInstance = exports.createInstance = exports.InstanceNotFoundError = void 0;
const uuid_1 = require("uuid");
const cosmosClient_1 = require("../cosmosClient");
const config_1 = require("../config");
class InstanceNotFoundError extends Error {
    constructor(instanceId) {
        super(`Workflow instance ${instanceId} not found`);
        this.name = 'InstanceNotFoundError';
    }
}
exports.InstanceNotFoundError = InstanceNotFoundError;
/**
 * Create a new workflow instance
 */
const createInstance = async (params) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const config = (0, config_1.getConfig)();
    const instanceId = `inst-${(0, uuid_1.v4)().slice(0, 12)}`;
    const now = new Date().toISOString();
    const instance = {
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
    return resource;
};
exports.createInstance = createInstance;
/**
 * Get a workflow instance by ID
 */
const getInstance = async (instanceId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: 'SELECT * FROM c WHERE c.instanceId = @instanceId',
        parameters: [{ name: '@instanceId', value: instanceId }]
    };
    const { resources } = await containers.workflowInstances.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new InstanceNotFoundError(instanceId);
    }
    return resources[0];
};
exports.getInstance = getInstance;
/**
 * Update a workflow instance
 */
const updateInstance = async (instanceId, updates) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const current = await (0, exports.getInstance)(instanceId);
    const updated = {
        ...current,
        ...updates,
        instanceId: current.instanceId // Ensure instanceId is not overwritten
    };
    await containers.workflowInstances.items.upsert(updated);
    return updated;
};
exports.updateInstance = updateInstance;
/**
 * Update instance status
 */
const updateInstanceStatus = async (instanceId, status, additionalUpdates) => {
    const updates = {
        status,
        ...additionalUpdates
    };
    if (status === 'running' && !additionalUpdates?.startedAt) {
        updates.startedAt = new Date().toISOString();
    }
    if (['completed', 'failed', 'cancelled', 'timed_out'].includes(status) &&
        !additionalUpdates?.completedAt) {
        updates.completedAt = new Date().toISOString();
    }
    return (0, exports.updateInstance)(instanceId, updates);
};
exports.updateInstanceStatus = updateInstanceStatus;
/**
 * Update the current step being executed
 */
const updateCurrentStep = async (instanceId, stepId, stepExecution) => {
    const current = await (0, exports.getInstance)(instanceId);
    // Update or add step execution
    const existingIndex = current.stepExecutions.findIndex((s) => s.stepId === stepId);
    const updatedExecutions = [...current.stepExecutions];
    if (existingIndex >= 0) {
        updatedExecutions[existingIndex] = stepExecution;
    }
    else {
        updatedExecutions.push(stepExecution);
    }
    // Update completed steps if step is completed
    let completedStepIds = current.completedStepIds;
    if (stepExecution.status === 'completed') {
        completedStepIds = [...new Set([...completedStepIds, stepId])];
    }
    return (0, exports.updateInstance)(instanceId, {
        currentStepId: stepId,
        stepExecutions: updatedExecutions,
        completedStepIds
    });
};
exports.updateCurrentStep = updateCurrentStep;
/**
 * Update workflow variables
 */
const updateVariables = async (instanceId, variableUpdates) => {
    const current = await (0, exports.getInstance)(instanceId);
    return (0, exports.updateInstance)(instanceId, {
        variables: {
            ...current.variables,
            ...variableUpdates
        }
    });
};
exports.updateVariables = updateVariables;
/**
 * List workflow instances with filters
 */
const listInstances = async (filters) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    let query = 'SELECT * FROM c WHERE 1=1';
    const parameters = [];
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
        }
        else {
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
        .query({ query, parameters })
        .fetchAll();
    return resources;
};
exports.listInstances = listInstances;
/**
 * Get step execution logs for an instance
 */
const getInstanceLogs = async (instanceId) => {
    const instance = await (0, exports.getInstance)(instanceId);
    return instance.stepExecutions;
};
exports.getInstanceLogs = getInstanceLogs;
/**
 * Cancel a running instance
 */
const cancelInstance = async (instanceId, userId, reason) => {
    const instance = await (0, exports.getInstance)(instanceId);
    if (!['pending', 'running', 'waiting', 'paused'].includes(instance.status)) {
        throw new Error(`Cannot cancel instance with status ${instance.status}`);
    }
    return (0, exports.updateInstanceStatus)(instanceId, 'cancelled', {
        lastError: {
            stepId: instance.currentStepId || '',
            code: 'CANCELLED',
            message: reason || `Cancelled by ${userId}`,
            timestamp: new Date().toISOString()
        }
    });
};
exports.cancelInstance = cancelInstance;
/**
 * Pause a running instance
 */
const pauseInstance = async (instanceId) => {
    const instance = await (0, exports.getInstance)(instanceId);
    if (instance.status !== 'running') {
        throw new Error(`Cannot pause instance with status ${instance.status}`);
    }
    return (0, exports.updateInstanceStatus)(instanceId, 'paused');
};
exports.pauseInstance = pauseInstance;
/**
 * Resume a paused instance
 */
const resumeInstance = async (instanceId) => {
    const instance = await (0, exports.getInstance)(instanceId);
    if (instance.status !== 'paused') {
        throw new Error(`Cannot resume instance with status ${instance.status}`);
    }
    return (0, exports.updateInstanceStatus)(instanceId, 'running');
};
exports.resumeInstance = resumeInstance;
/**
 * Get child instances of a parent instance
 */
const getChildInstances = async (parentInstanceId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: 'SELECT * FROM c WHERE c.parentInstanceId = @parentInstanceId ORDER BY c.createdAt DESC',
        parameters: [{ name: '@parentInstanceId', value: parentInstanceId }]
    };
    const { resources } = await containers.workflowInstances.items
        .query(query)
        .fetchAll();
    return resources;
};
exports.getChildInstances = getChildInstances;
/**
 * Get instance statistics for a workflow
 */
const getInstanceStats = async (workflowId, organizationId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
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
        .query(query)
        .fetchAll();
    const stats = {};
    for (const resource of resources) {
        stats[resource.status] = resource.count;
    }
    return stats;
};
exports.getInstanceStats = getInstanceStats;
//# sourceMappingURL=instanceRepository.js.map