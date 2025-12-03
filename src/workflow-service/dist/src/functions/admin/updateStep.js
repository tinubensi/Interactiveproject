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
        const stepId = request.params.stepId;
        if (!workflowId) {
            return (0, httpResponses_1.badRequestResponse)('Workflow ID is required');
        }
        if (!stepId) {
            return (0, httpResponses_1.badRequestResponse)('Step ID is required');
        }
        const body = (await request.json());
        context.log('Updating step', { workflowId, stepId });
        const workflow = await (0, workflowRepository_1.updateStep)(workflowId, stepId, body, userContext.userId);
        context.log(`Updated step ${stepId} in workflow ${workflowId}`);
        return (0, httpResponses_1.successResponse)(workflow);
    }
    catch (error) {
        context.error('Error updating step', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('UpdateStep', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/steps/{stepId}/update',
    handler
});
//# sourceMappingURL=updateStep.js.map