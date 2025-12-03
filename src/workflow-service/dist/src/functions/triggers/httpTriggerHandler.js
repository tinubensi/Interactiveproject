"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const workflowRepository_1 = require("../../lib/repositories/workflowRepository");
const instanceRepository_1 = require("../../lib/repositories/instanceRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const handler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        const userContext = (0, auth_1.ensureAuthorized)(request);
        const workflowId = request.params.workflowId;
        if (!workflowId) {
            return (0, httpResponses_1.badRequestResponse)('Workflow ID is required');
        }
        context.log('Triggering workflow', { workflowId });
        // Get the active workflow
        const workflow = await (0, workflowRepository_1.getWorkflow)(workflowId);
        if (workflow.status !== 'active') {
            return (0, httpResponses_1.badRequestResponse)(`Workflow ${workflowId} is not active (status: ${workflow.status})`);
        }
        // Find HTTP trigger
        const httpTrigger = workflow.triggers.find((t) => t.type === 'http');
        if (!httpTrigger) {
            return (0, httpResponses_1.badRequestResponse)(`Workflow ${workflowId} does not have an HTTP trigger configured`);
        }
        const triggerConfig = httpTrigger.config;
        // Validate HTTP method if specified
        if (triggerConfig.method &&
            request.method !== triggerConfig.method &&
            request.method !== 'OPTIONS') {
            return (0, httpResponses_1.badRequestResponse)(`Invalid HTTP method. Expected ${triggerConfig.method}`);
        }
        // Parse request body
        let payload = {};
        try {
            payload = (await request.json());
        }
        catch {
            // Empty body is acceptable
        }
        // TODO: Validate payload against triggerConfig.validatePayload schema
        // Check if parallel executions are allowed
        if (workflow.settings?.allowParallelExecutions === false) {
            // TODO: Check for existing running instances
        }
        // Create the workflow instance
        const instanceParams = {
            workflowId: workflow.workflowId,
            workflowVersion: workflow.version,
            workflowName: workflow.name,
            organizationId: workflow.organizationId,
            triggerId: httpTrigger.id,
            triggerType: 'http',
            triggerData: {
                method: request.method,
                url: request.url,
                headers: Object.fromEntries(request.headers),
                body: payload
            },
            variables: {
                ...getDefaultVariables(workflow.variables),
                ...payload.variables,
                // Include trigger input in variables
                input: payload
            },
            correlationId: payload.correlationId,
            initiatedBy: payload.initiatedBy || userContext.userId
        };
        const instance = await (0, instanceRepository_1.createInstance)(instanceParams);
        context.log(`Created workflow instance ${instance.instanceId} for workflow ${workflowId}`);
        // TODO: Start the Durable Functions orchestrator
        return (0, httpResponses_1.createdResponse)({
            instanceId: instance.instanceId,
            workflowId: instance.workflowId,
            workflowName: instance.workflowName,
            status: instance.status,
            createdAt: instance.createdAt,
            message: 'Workflow instance created successfully'
        });
    }
    catch (error) {
        if (error instanceof workflowRepository_1.WorkflowNotFoundError) {
            return (0, httpResponses_1.notFoundResponse)('Workflow');
        }
        context.error('Error triggering workflow', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
/**
 * Get default values for workflow variables
 */
const getDefaultVariables = (variableDefinitions) => {
    if (!variableDefinitions) {
        return {};
    }
    const defaults = {};
    for (const [key, def] of Object.entries(variableDefinitions)) {
        if (def.defaultValue !== undefined) {
            defaults[key] = def.defaultValue;
        }
    }
    return defaults;
};
functions_1.app.http('TriggerWorkflow', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/trigger',
    handler
});
//# sourceMappingURL=httpTriggerHandler.js.map