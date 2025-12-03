"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWorkflowFromTemplate = exports.deleteTemplate = exports.updateTemplate = exports.listTemplates = exports.getTemplate = exports.createTemplate = exports.TemplateValidationError = exports.TemplateNotFoundError = void 0;
const uuid_1 = require("uuid");
const cosmosClient_1 = require("../cosmosClient");
// ----------------------------------------------------------------------------
// Errors
// ----------------------------------------------------------------------------
class TemplateNotFoundError extends Error {
    constructor(templateId) {
        super(`Template ${templateId} not found`);
        this.name = 'TemplateNotFoundError';
    }
}
exports.TemplateNotFoundError = TemplateNotFoundError;
class TemplateValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = 'TemplateValidationError';
    }
}
exports.TemplateValidationError = TemplateValidationError;
// ----------------------------------------------------------------------------
// Create Template
// ----------------------------------------------------------------------------
const createTemplate = async (request, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const templateId = `tpl-${(0, uuid_1.v4)().slice(0, 8)}`;
    const now = new Date().toISOString();
    const template = {
        id: templateId,
        templateId,
        name: request.name,
        description: request.description,
        category: request.category,
        tags: request.tags || [],
        baseWorkflow: request.baseWorkflow,
        requiredVariables: request.requiredVariables || [],
        configurationSchema: request.configurationSchema,
        previewImage: request.previewImage,
        documentation: request.documentation,
        isPublic: request.isPublic ?? true,
        organizationId: request.organizationId,
        createdAt: now,
        createdBy: userId,
        version: 1,
    };
    const { resource } = await containers.workflowTemplates.items.create(template);
    return resource;
};
exports.createTemplate = createTemplate;
// ----------------------------------------------------------------------------
// Get Template
// ----------------------------------------------------------------------------
const getTemplate = async (templateId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const query = {
        query: `
      SELECT * FROM c 
      WHERE c.templateId = @templateId
    `,
        parameters: [{ name: '@templateId', value: templateId }],
    };
    const { resources } = await containers.workflowTemplates.items
        .query(query)
        .fetchAll();
    if (resources.length === 0) {
        throw new TemplateNotFoundError(templateId);
    }
    return resources[0];
};
exports.getTemplate = getTemplate;
// ----------------------------------------------------------------------------
// List Templates
// ----------------------------------------------------------------------------
const listTemplates = async (filters) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    let query = `SELECT * FROM c WHERE 1=1`;
    const parameters = [];
    // Public templates or organization-specific
    if (filters?.organizationId) {
        query += ` AND (c.isPublic = true OR c.organizationId = @organizationId)`;
        parameters.push({ name: '@organizationId', value: filters.organizationId });
    }
    else if (filters?.isPublic !== undefined) {
        query += ` AND c.isPublic = @isPublic`;
        parameters.push({ name: '@isPublic', value: filters.isPublic });
    }
    if (filters?.category) {
        query += ` AND c.category = @category`;
        parameters.push({ name: '@category', value: filters.category });
    }
    if (filters?.tags && filters.tags.length > 0) {
        query += ` AND ARRAY_LENGTH(SetIntersect(c.tags, @tags)) > 0`;
        parameters.push({ name: '@tags', value: filters.tags });
    }
    if (filters?.search) {
        query += ` AND (CONTAINS(LOWER(c.name), LOWER(@search)) OR CONTAINS(LOWER(c.description), LOWER(@search)))`;
        parameters.push({ name: '@search', value: filters.search });
    }
    query += ` ORDER BY c.createdAt DESC`;
    const { resources } = await containers.workflowTemplates.items
        .query({ query, parameters })
        .fetchAll();
    return resources;
};
exports.listTemplates = listTemplates;
// ----------------------------------------------------------------------------
// Update Template
// ----------------------------------------------------------------------------
const updateTemplate = async (templateId, updates, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const current = await (0, exports.getTemplate)(templateId);
    const now = new Date().toISOString();
    const updatedTemplate = {
        ...current,
        name: updates.name ?? current.name,
        description: updates.description ?? current.description,
        category: updates.category ?? current.category,
        tags: updates.tags ?? current.tags,
        baseWorkflow: updates.baseWorkflow
            ? {
                triggers: updates.baseWorkflow.triggers ?? current.baseWorkflow.triggers,
                steps: updates.baseWorkflow.steps ?? current.baseWorkflow.steps,
                variables: updates.baseWorkflow.variables ?? current.baseWorkflow.variables,
                settings: updates.baseWorkflow.settings ?? current.baseWorkflow.settings,
            }
            : current.baseWorkflow,
        requiredVariables: updates.requiredVariables ?? current.requiredVariables,
        configurationSchema: updates.configurationSchema ?? current.configurationSchema,
        previewImage: updates.previewImage ?? current.previewImage,
        documentation: updates.documentation ?? current.documentation,
        isPublic: updates.isPublic ?? current.isPublic,
        updatedAt: now,
        updatedBy: userId,
        version: current.version + 1,
    };
    const { resource } = await containers.workflowTemplates.items.upsert(updatedTemplate);
    return (resource ?? updatedTemplate);
};
exports.updateTemplate = updateTemplate;
// ----------------------------------------------------------------------------
// Delete Template
// ----------------------------------------------------------------------------
const deleteTemplate = async (templateId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    // First verify it exists
    const template = await (0, exports.getTemplate)(templateId);
    await containers.workflowTemplates.item(template.id, template.id).delete();
};
exports.deleteTemplate = deleteTemplate;
// ----------------------------------------------------------------------------
// Create Workflow from Template
// ----------------------------------------------------------------------------
const createWorkflowFromTemplate = async (request, userId) => {
    const containers = await (0, cosmosClient_1.getCosmosContainers)();
    const template = await (0, exports.getTemplate)(request.templateId);
    const now = new Date().toISOString();
    const workflowId = `wf-${(0, uuid_1.v4)().slice(0, 8)}`;
    // Generate new IDs for steps
    const stepIdMap = new Map();
    const newSteps = template.baseWorkflow.steps.map((step) => {
        const newStepId = `step-${(0, uuid_1.v4)().slice(0, 8)}`;
        stepIdMap.set(step.id, newStepId);
        return { ...step, id: newStepId };
    });
    // Update step references (transitions, conditions)
    for (const step of newSteps) {
        if (step.transitions) {
            step.transitions = step.transitions.map((t) => ({
                ...t,
                targetStepId: stepIdMap.get(t.targetStepId) || t.targetStepId,
            }));
        }
        if (step.conditions) {
            step.conditions = step.conditions.map((c) => ({
                ...c,
                targetStepId: stepIdMap.get(c.targetStepId) || c.targetStepId,
            }));
        }
        // Handle nested steps in parallel/loop configs
        if (step.parallelConfig?.branches) {
            step.parallelConfig.branches = step.parallelConfig.branches.map((branch) => ({
                ...branch,
                id: `branch-${(0, uuid_1.v4)().slice(0, 8)}`,
                steps: branch.steps.map((s) => ({
                    ...s,
                    id: `step-${(0, uuid_1.v4)().slice(0, 8)}`,
                })),
            }));
        }
        if (step.loopConfig?.steps) {
            step.loopConfig.steps = step.loopConfig.steps.map((s) => ({
                ...s,
                id: `step-${(0, uuid_1.v4)().slice(0, 8)}`,
            }));
        }
    }
    // Generate new IDs for triggers
    const newTriggers = template.baseWorkflow.triggers.map((trigger) => ({
        ...trigger,
        id: `trigger-${(0, uuid_1.v4)().slice(0, 8)}`,
    }));
    // Apply configuration substitutions if provided
    let variables = { ...template.baseWorkflow.variables };
    let settings = template.baseWorkflow.settings ? { ...template.baseWorkflow.settings } : undefined;
    if (request.configuration && template.configurationSchema) {
        // Apply configuration values
        // This is a simple implementation - could be enhanced with JSONata or similar
        for (const [key, value] of Object.entries(request.configuration)) {
            // Store configuration in variables or settings as appropriate
            if (key in (template.baseWorkflow.variables || {})) {
                variables = {
                    ...variables,
                    [key]: {
                        ...variables[key],
                        defaultValue: value,
                    },
                };
            }
        }
    }
    const workflow = {
        id: `${workflowId}-v1`,
        workflowId,
        name: request.name,
        description: request.description || `Created from template: ${template.name}`,
        version: 1,
        status: 'draft',
        organizationId: request.organizationId,
        triggers: newTriggers,
        steps: newSteps,
        variables,
        settings,
        tags: template.tags,
        category: template.category,
        createdAt: now,
        createdBy: userId,
    };
    const { resource } = await containers.workflowDefinitions.items.create(workflow);
    return resource;
};
exports.createWorkflowFromTemplate = createWorkflowFromTemplate;
//# sourceMappingURL=templateRepository.js.map