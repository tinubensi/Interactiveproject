"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const workflowRepository_1 = require("../../lib/repositories/workflowRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const validation_1 = require("../../lib/validation");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const handler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        (0, auth_1.ensureAuthorized)(request);
        const workflowId = request.params.workflowId;
        if (!workflowId) {
            return (0, httpResponses_1.badRequestResponse)('Workflow ID is required');
        }
        context.log('Validating workflow', { workflowId });
        const workflow = await (0, workflowRepository_1.getWorkflow)(workflowId);
        const validation = (0, validation_1.validateWorkflowIntegrity)(workflow);
        return (0, httpResponses_1.successResponse)({
            workflowId,
            version: workflow.version,
            valid: validation.valid,
            errors: validation.errors,
            canActivate: validation.valid && workflow.steps.length > 0
        });
    }
    catch (error) {
        context.error('Error validating workflow', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ValidateWorkflow', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/validate',
    handler
});
//# sourceMappingURL=validateWorkflow.js.map