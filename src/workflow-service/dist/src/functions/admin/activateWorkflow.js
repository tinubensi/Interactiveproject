"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const workflowRepository_1 = require("../../lib/repositories/workflowRepository");
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
        const body = (await request.json().catch(() => ({})));
        context.log('Activating workflow', { workflowId, version: body.version });
        const workflow = await (0, workflowRepository_1.activateWorkflow)(workflowId, userContext.userId, body.version);
        context.log(`Activated workflow ${workflowId} version ${workflow.version}`);
        return (0, httpResponses_1.successResponse)(workflow);
    }
    catch (error) {
        context.error('Error activating workflow', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ActivateWorkflow', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/activate',
    handler
});
//# sourceMappingURL=activateWorkflow.js.map