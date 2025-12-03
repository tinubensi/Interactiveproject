"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reorderSteps = exports.deleteStep = exports.updateStep = exports.addStep = exports.getWorkflowVersions = exports.cloneWorkflow = exports.deleteWorkflow = exports.deactivateWorkflow = exports.activateWorkflow = exports.listWorkflows = exports.updateWorkflow = exports.getWorkflowByVersion = exports.getWorkflow = exports.createWorkflow = exports.WorkflowValidationError = exports.StepNotFoundError = exports.WorkflowNotFoundError = void 0;
const uuid_1 = require("uuid");
const cosmosClient_1 = require("../cosmosClient");
const validation_1 = require("../validation");
class WorkflowNotFoundError extends Error {
    constructor(workflowId, version) {
        const message = version
            ? `Workflow ${workflowId} version ${version} not found`
            : `Workflow ${workflowId} not found`;
        super(message);
        this.name = 'WorkflowNotFoundError';
    }
}
exports.WorkflowNotFoundError = WorkflowNotFoundError;
class StepNotFoundError extends Error {
    constructor(stepId) {
        super(`Step ${stepId} not found`);
        this.name = 'StepNotFoundError';
    }
}
exports.StepNotFoundError = StepNotFoundError;
class WorkflowValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'WorkflowValidationError';
    }
}
exports.WorkflowValidationError = WorkflowValidationError;
/**
 * Create a new workflow
 */
const createWorkflow = async (request, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const workflowId = `wf-${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const workflow = {
        id: `${workflowId}-v1`,
        workflowId,
        name: request.name,
        description: request.description,
        version: 1,
        status: 'draft',
        organizationId: request.organizationId,
        triggers: request.triggers || [],
        steps: request.steps || [],
        variables: request.variables,
        settings: request.settings,
        tags: request.tags,
        category: request.category,
        createdAt: now,
        createdBy: userId
    };
    const { resource } = await containers.workflowDefinitions.items.create(workflow);
    return resource;
};
exports.createWorkflow = createWorkflow;
/**
 * Get the latest version of a workflow
 */
const getWorkflow = async (workflowId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
      ORDER BY c.version DESC
      OFFSET 0 LIMIT 1
    `,
        parameters: [{ name: '@workflowId', value: workflowId }]
    };
    const { resources } = await containers.workflowDefinitions.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new WorkflowNotFoundError(workflowId);
    }
    return resources[0];
};
exports.getWorkflow = getWorkflow;
/**
 * Get a specific version of a workflow
 */
const getWorkflowByVersion = async (workflowId, version) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.version = @version
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
    `,
        parameters: [
            { name: '@workflowId', value: workflowId },
            { name: '@version', value: version }
        ]
    };
    const { resources } = await containers.workflowDefinitions.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new WorkflowNotFoundError(workflowId, version);
    }
    return resources[0];
};
exports.getWorkflowByVersion = getWorkflowByVersion;
/**
 * Update a workflow - creates a new version
 */
const updateWorkflow = async (workflowId, updates, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const current = await (0, exports.getWorkflow)(workflowId);
    const now = new Date().toISOString();
    const newVersion = current.version + 1;
    const newWorkflow = {
        ...current,
        id: `${workflowId}-v${newVersion}`,
        version: newVersion,
        status: 'draft',
        name: updates.name ?? current.name,
        description: updates.description ?? current.description,
        triggers: updates.triggers ?? current.triggers,
        steps: updates.steps ?? current.steps,
        variables: updates.variables ?? current.variables,
        settings: updates.settings ?? current.settings,
        tags: updates.tags ?? current.tags,
        category: updates.category ?? current.category,
        updatedAt: now,
        updatedBy: userId,
        activatedAt: undefined,
        activatedBy: undefined
    };
    const { resource } = await containers.workflowDefinitions.items.create(newWorkflow);
    return resource;
};
exports.updateWorkflow = updateWorkflow;
/**
 * List workflows with filters
 */
const listWorkflows = async (filters) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    let query = `
    SELECT * FROM c 
    WHERE (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
  `;
    const parameters = [];
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
    if (filters?.category) {
        query += ' AND c.category = @category';
        parameters.push({ name: '@category', value: filters.category });
    }
    if (filters?.tags && filters.tags.length > 0) {
        query += ' AND ARRAY_LENGTH(SetIntersect(c.tags, @tags)) > 0';
        parameters.push({ name: '@tags', value: filters.tags });
    }
    if (filters?.search) {
        query += ' AND (CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))';
        parameters.push({ name: '@search', value: filters.search });
    }
    query += ' ORDER BY c.createdAt DESC';
    const { resources } = await containers.workflowDefinitions.items
        .query({ query, parameters })
        .fetchAll();
    // Get only the latest version of each workflow
    const latestVersions = new Map();
    for (const wf of resources) {
        const existing = latestVersions.get(wf.workflowId);
        if (!existing || wf.version > existing.version) {
            latestVersions.set(wf.workflowId, wf);
        }
    }
    return Array.from(latestVersions.values());
};
exports.listWorkflows = listWorkflows;
/**
 * Activate a workflow
 */
const activateWorkflow = async (workflowId, userId, version) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const workflow = version
        ? await (0, exports.getWorkflowByVersion)(workflowId, version)
        : await (0, exports.getWorkflow)(workflowId);
    // Validate workflow before activation
    if (!workflow.steps || workflow.steps.length === 0) {
        throw new WorkflowValidationError('Cannot activate workflow without steps');
    }
    const validation = (0, validation_1.validateWorkflowIntegrity)(workflow);
    if (!validation.valid) {
        throw new WorkflowValidationError(`Workflow validation failed: ${validation.errors.map((e) => e.message).join(', ')}`);
    }
    const now = new Date().toISOString();
    // Deactivate any currently active version
    const activeQuery = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.status = 'active'
    `,
        parameters: [{ name: '@workflowId', value: workflowId }]
    };
    const { resources: activeVersions } = await containers.workflowDefinitions.items
        .query(activeQuery)
        .fetchAll();
    for (const activeVersion of activeVersions) {
        await containers.workflowDefinitions.items.upsert({
            ...activeVersion,
            status: 'inactive',
            updatedAt: now,
            updatedBy: userId
        });
    }
    // Activate the target version
    const activatedWorkflow = {
        ...workflow,
        status: 'active',
        activatedAt: now,
        activatedBy: userId,
        updatedAt: now,
        updatedBy: userId
    };
    await containers.workflowDefinitions.items.upsert(activatedWorkflow);
    return activatedWorkflow;
};
exports.activateWorkflow = activateWorkflow;
/**
 * Deactivate a workflow
 */
const deactivateWorkflow = async (workflowId, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const now = new Date().toISOString();
    // Find the active version
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND c.status = 'active'
    `,
        parameters: [{ name: '@workflowId', value: workflowId }]
    };
    const { resources } = await containers.workflowDefinitions.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new WorkflowNotFoundError(workflowId);
    }
    const workflow = resources[0];
    const deactivatedWorkflow = {
        ...workflow,
        status: 'inactive',
        updatedAt: now,
        updatedBy: userId
    };
    await containers.workflowDefinitions.items.upsert(deactivatedWorkflow);
    return deactivatedWorkflow;
};
exports.deactivateWorkflow = deactivateWorkflow;
/**
 * Soft delete a workflow (all versions)
 */
const deleteWorkflow = async (workflowId, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const now = new Date().toISOString();
    // Get all versions
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId
    `,
        parameters: [{ name: '@workflowId', value: workflowId }]
    };
    const { resources } = await containers.workflowDefinitions.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new WorkflowNotFoundError(workflowId);
    }
    // Soft delete all versions
    for (const workflow of resources) {
        await containers.workflowDefinitions.items.upsert({
            ...workflow,
            isDeleted: true,
            deletedAt: now,
            deletedBy: userId,
            status: 'deprecated'
        });
    }
};
exports.deleteWorkflow = deleteWorkflow;
/**
 * Clone a workflow
 */
const cloneWorkflow = async (sourceWorkflowId, newName, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const source = await (0, exports.getWorkflow)(sourceWorkflowId);
    const now = new Date().toISOString();
    const newWorkflowId = `wf-${(0, uuid_1.v4)().slice(0, 8)}`;
    // Clone steps with new IDs
    const stepIdMap = new Map();
    const clonedSteps = source.steps.map((step) => {
        const newStepId = `step-${(0, uuid_1.v4)().slice(0, 8)}`;
        stepIdMap.set(step.id, newStepId);
        return { ...step, id: newStepId };
    });
    // Update transition references
    for (const step of clonedSteps) {
        if (step.transitions) {
            step.transitions = step.transitions.map((t) => ({
                ...t,
                targetStepId: stepIdMap.get(t.targetStepId) || t.targetStepId
            }));
        }
        if (step.conditions) {
            step.conditions = step.conditions.map((c) => ({
                ...c,
                targetStepId: stepIdMap.get(c.targetStepId) || c.targetStepId
            }));
        }
    }
    // Clone triggers with new IDs
    const clonedTriggers = source.triggers.map((trigger) => ({
        ...trigger,
        id: `trigger-${(0, uuid_1.v4)().slice(0, 8)}`
    }));
    const clonedWorkflow = {
        id: `${newWorkflowId}-v1`,
        workflowId: newWorkflowId,
        name: newName,
        description: source.description
            ? `Cloned from ${source.name}: ${source.description}`
            : `Cloned from ${source.name}`,
        version: 1,
        status: 'draft',
        organizationId: source.organizationId,
        triggers: clonedTriggers,
        steps: clonedSteps,
        variables: source.variables,
        settings: source.settings,
        tags: source.tags,
        category: source.category,
        createdAt: now,
        createdBy: userId
    };
    const { resource } = await containers.workflowDefinitions.items.create(clonedWorkflow);
    return resource;
};
exports.cloneWorkflow = cloneWorkflow;
/**
 * Get all versions of a workflow
 */
const getWorkflowVersions = async (workflowId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId 
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
      ORDER BY c.version DESC
    `,
        parameters: [{ name: '@workflowId', value: workflowId }]
    };
    const { resources } = await containers.workflowDefinitions.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new WorkflowNotFoundError(workflowId);
    }
    return resources;
};
exports.getWorkflowVersions = getWorkflowVersions;
/**
 * Add a step to a workflow
 */
const addStep = async (workflowId, request, userId) => {
    const current = await (0, exports.getWorkflow)(workflowId);
    const newStepId = `step-${(0, uuid_1.v4)().slice(0, 8)}`;
    const newStep = {
        ...request.step,
        id: newStepId
    };
    let steps = [...current.steps];
    if (request.afterStepId) {
        // Insert after the specified step
        const afterIndex = steps.findIndex((s) => s.id === request.afterStepId);
        if (afterIndex === -1) {
            throw new StepNotFoundError(request.afterStepId);
        }
        // Insert at the right position
        steps.splice(afterIndex + 1, 0, newStep);
        // Recalculate order values
        steps = steps.map((step, index) => ({
            ...step,
            order: index + 1
        }));
    }
    else {
        // Add at the end or at the specified order
        if (newStep.order === undefined) {
            newStep.order = steps.length + 1;
        }
        steps.push(newStep);
        steps.sort((a, b) => a.order - b.order);
    }
    return (0, exports.updateWorkflow)(workflowId, { steps }, userId);
};
exports.addStep = addStep;
/**
 * Update a step in a workflow
 */
const updateStep = async (workflowId, stepId, updates, userId) => {
    const current = await (0, exports.getWorkflow)(workflowId);
    const stepIndex = current.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
        throw new StepNotFoundError(stepId);
    }
    const updatedSteps = [...current.steps];
    updatedSteps[stepIndex] = {
        ...updatedSteps[stepIndex],
        ...updates
    };
    return (0, exports.updateWorkflow)(workflowId, { steps: updatedSteps }, userId);
};
exports.updateStep = updateStep;
/**
 * Delete a step from a workflow
 */
const deleteStep = async (workflowId, stepId, userId) => {
    const current = await (0, exports.getWorkflow)(workflowId);
    const stepIndex = current.steps.findIndex((s) => s.id === stepId);
    if (stepIndex === -1) {
        throw new StepNotFoundError(stepId);
    }
    const updatedSteps = current.steps
        .filter((s) => s.id !== stepId)
        .map((step, index) => ({
        ...step,
        order: index + 1
    }));
    // Remove references to the deleted step in transitions
    for (const step of updatedSteps) {
        if (step.transitions) {
            step.transitions = step.transitions.filter((t) => t.targetStepId !== stepId);
        }
        if (step.conditions) {
            step.conditions = step.conditions.filter((c) => c.targetStepId !== stepId);
        }
    }
    return (0, exports.updateWorkflow)(workflowId, { steps: updatedSteps }, userId);
};
exports.deleteStep = deleteStep;
/**
 * Reorder steps in a workflow
 */
const reorderSteps = async (workflowId, request, userId) => {
    const current = await (0, exports.getWorkflow)(workflowId);
    const orderMap = new Map(request.stepOrder.map((o) => [o.stepId, o.order]));
    const updatedSteps = current.steps.map((step) => {
        const newOrder = orderMap.get(step.id);
        if (newOrder !== undefined) {
            return { ...step, order: newOrder };
        }
        return step;
    });
    updatedSteps.sort((a, b) => a.order - b.order);
    return (0, exports.updateWorkflow)(workflowId, { steps: updatedSteps }, userId);
};
exports.reorderSteps = reorderSteps;
//# sourceMappingURL=workflowRepository.js.map