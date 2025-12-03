"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateWorkflowIntegrity = exports.validateWorkflowSteps = exports.validateAddStepRequest = exports.validateUpdateWorkflowRequest = exports.validateCreateWorkflowRequest = exports.validateWorkflowDefinition = exports.ValidationError = void 0;
const ajv_1 = __importDefault(require("ajv"));
const ajv_formats_1 = __importDefault(require("ajv-formats"));
const workflowDefinition_schema_json_1 = __importDefault(require("../schemas/workflowDefinition.schema.json"));
// Initialize AJV with formats
const ajv = new ajv_1.default({
    allErrors: true,
    strict: false,
    allowUnionTypes: true
});
(0, ajv_formats_1.default)(ajv);
// Compile schemas
const validateWorkflowDefinitionSchema = ajv.compile(workflowDefinition_schema_json_1.default);
class ValidationError extends Error {
    constructor(message, errors) {
        super(message);
        this.errors = errors;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
const formatAjvErrors = (errors) => {
    if (!errors)
        return [];
    return errors.map((err) => ({
        path: err.instancePath || '/',
        message: err.message || 'Validation failed'
    }));
};
const validateWorkflowDefinition = (workflow) => {
    const valid = validateWorkflowDefinitionSchema(workflow);
    if (!valid) {
        throw new ValidationError('Invalid workflow definition', formatAjvErrors(validateWorkflowDefinitionSchema.errors));
    }
    return workflow;
};
exports.validateWorkflowDefinition = validateWorkflowDefinition;
const validateCreateWorkflowRequest = (request) => {
    if (!request || typeof request !== 'object') {
        throw new ValidationError('Request body is required', [
            { path: '/', message: 'Request body must be an object' }
        ]);
    }
    const req = request;
    const errors = [];
    if (!req.name || typeof req.name !== 'string' || req.name.trim() === '') {
        errors.push({ path: '/name', message: 'Name is required' });
    }
    else if (req.name.length > 200) {
        errors.push({
            path: '/name',
            message: 'Name must be at most 200 characters'
        });
    }
    if (!req.organizationId ||
        typeof req.organizationId !== 'string' ||
        req.organizationId.trim() === '') {
        errors.push({
            path: '/organizationId',
            message: 'Organization ID is required'
        });
    }
    if (req.description && typeof req.description !== 'string') {
        errors.push({ path: '/description', message: 'Description must be a string' });
    }
    if (req.triggers && !Array.isArray(req.triggers)) {
        errors.push({ path: '/triggers', message: 'Triggers must be an array' });
    }
    if (req.steps && !Array.isArray(req.steps)) {
        errors.push({ path: '/steps', message: 'Steps must be an array' });
    }
    if (errors.length > 0) {
        throw new ValidationError('Invalid create workflow request', errors);
    }
    return request;
};
exports.validateCreateWorkflowRequest = validateCreateWorkflowRequest;
const validateUpdateWorkflowRequest = (request) => {
    if (!request || typeof request !== 'object') {
        throw new ValidationError('Request body is required', [
            { path: '/', message: 'Request body must be an object' }
        ]);
    }
    const req = request;
    const errors = [];
    if (req.name !== undefined) {
        if (typeof req.name !== 'string' || req.name.trim() === '') {
            errors.push({ path: '/name', message: 'Name must be a non-empty string' });
        }
        else if (req.name.length > 200) {
            errors.push({
                path: '/name',
                message: 'Name must be at most 200 characters'
            });
        }
    }
    if (req.description !== undefined && typeof req.description !== 'string') {
        errors.push({ path: '/description', message: 'Description must be a string' });
    }
    if (req.triggers !== undefined && !Array.isArray(req.triggers)) {
        errors.push({ path: '/triggers', message: 'Triggers must be an array' });
    }
    if (req.steps !== undefined && !Array.isArray(req.steps)) {
        errors.push({ path: '/steps', message: 'Steps must be an array' });
    }
    if (errors.length > 0) {
        throw new ValidationError('Invalid update workflow request', errors);
    }
    return request;
};
exports.validateUpdateWorkflowRequest = validateUpdateWorkflowRequest;
const validateAddStepRequest = (request) => {
    if (!request || typeof request !== 'object') {
        throw new ValidationError('Request body is required', [
            { path: '/', message: 'Request body must be an object' }
        ]);
    }
    const req = request;
    const errors = [];
    if (!req.step || typeof req.step !== 'object') {
        errors.push({ path: '/step', message: 'Step is required' });
    }
    else {
        const step = req.step;
        if (!step.name || typeof step.name !== 'string') {
            errors.push({ path: '/step/name', message: 'Step name is required' });
        }
        if (!step.type || typeof step.type !== 'string') {
            errors.push({ path: '/step/type', message: 'Step type is required' });
        }
        if (step.order !== undefined && typeof step.order !== 'number') {
            errors.push({ path: '/step/order', message: 'Step order must be a number' });
        }
    }
    if (req.afterStepId !== undefined && typeof req.afterStepId !== 'string') {
        errors.push({
            path: '/afterStepId',
            message: 'afterStepId must be a string'
        });
    }
    if (errors.length > 0) {
        throw new ValidationError('Invalid add step request', errors);
    }
    return request;
};
exports.validateAddStepRequest = validateAddStepRequest;
const validateWorkflowSteps = (steps) => {
    const errors = [];
    const stepIds = new Set();
    for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const prefix = `/steps[${i}]`;
        // Check for duplicate step IDs
        if (stepIds.has(step.id)) {
            errors.push({
                path: `${prefix}/id`,
                message: `Duplicate step ID: ${step.id}`
            });
        }
        stepIds.add(step.id);
        // Validate step type-specific configuration
        switch (step.type) {
            case 'action':
                if (!step.action) {
                    errors.push({
                        path: `${prefix}/action`,
                        message: 'Action configuration is required for action steps'
                    });
                }
                break;
            case 'decision':
                if (!step.conditions || step.conditions.length === 0) {
                    errors.push({
                        path: `${prefix}/conditions`,
                        message: 'Conditions are required for decision steps'
                    });
                }
                break;
            case 'parallel':
                if (!step.parallelConfig || !step.parallelConfig.branches) {
                    errors.push({
                        path: `${prefix}/parallelConfig`,
                        message: 'Parallel configuration with branches is required'
                    });
                }
                break;
            case 'wait':
                if (!step.waitConfig) {
                    errors.push({
                        path: `${prefix}/waitConfig`,
                        message: 'Wait configuration is required for wait steps'
                    });
                }
                break;
            case 'loop':
                if (!step.loopConfig) {
                    errors.push({
                        path: `${prefix}/loopConfig`,
                        message: 'Loop configuration is required for loop steps'
                    });
                }
                break;
            case 'subworkflow':
                if (!step.subworkflowConfig || !step.subworkflowConfig.workflowId) {
                    errors.push({
                        path: `${prefix}/subworkflowConfig`,
                        message: 'Subworkflow configuration with workflowId is required'
                    });
                }
                break;
            case 'transform':
                if (!step.transformConfig) {
                    errors.push({
                        path: `${prefix}/transformConfig`,
                        message: 'Transform configuration is required for transform steps'
                    });
                }
                break;
            case 'script':
                if (!step.scriptConfig || !step.scriptConfig.code) {
                    errors.push({
                        path: `${prefix}/scriptConfig`,
                        message: 'Script configuration with code is required'
                    });
                }
                break;
            case 'delay':
                if (step.delaySeconds === undefined || step.delaySeconds < 0) {
                    errors.push({
                        path: `${prefix}/delaySeconds`,
                        message: 'Valid delaySeconds is required for delay steps'
                    });
                }
                break;
        }
        // Validate transitions reference valid step IDs
        if (step.transitions) {
            for (let j = 0; j < step.transitions.length; j++) {
                const transition = step.transitions[j];
                const targetExists = steps.some((s) => s.id === transition.targetStepId);
                if (!targetExists) {
                    errors.push({
                        path: `${prefix}/transitions[${j}]/targetStepId`,
                        message: `Invalid transition target: ${transition.targetStepId}`
                    });
                }
            }
        }
    }
    return { valid: errors.length === 0, errors };
};
exports.validateWorkflowSteps = validateWorkflowSteps;
const validateWorkflowIntegrity = (workflow) => {
    const errors = [];
    // Validate steps
    if (workflow.steps && workflow.steps.length > 0) {
        const stepValidation = (0, exports.validateWorkflowSteps)(workflow.steps);
        errors.push(...stepValidation.errors);
        // Check for at least one terminate step or valid end path
        const hasTerminateStep = workflow.steps.some((s) => s.type === 'terminate');
        if (!hasTerminateStep) {
            // Check if the last step has no transitions (implicit end)
            const sortedSteps = [...workflow.steps].sort((a, b) => a.order - b.order);
            const lastStep = sortedSteps[sortedSteps.length - 1];
            if (lastStep.transitions && lastStep.transitions.length > 0) {
                errors.push({
                    path: '/steps',
                    message: 'Workflow must have a terminate step or a step with no transitions'
                });
            }
        }
    }
    // Validate triggers
    if (workflow.triggers) {
        const triggerIds = new Set();
        for (let i = 0; i < workflow.triggers.length; i++) {
            const trigger = workflow.triggers[i];
            if (triggerIds.has(trigger.id)) {
                errors.push({
                    path: `/triggers[${i}]/id`,
                    message: `Duplicate trigger ID: ${trigger.id}`
                });
            }
            triggerIds.add(trigger.id);
        }
    }
    return { valid: errors.length === 0, errors };
};
exports.validateWorkflowIntegrity = validateWorkflowIntegrity;
//# sourceMappingURL=validation.js.map