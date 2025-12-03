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
        const userContext = (0, auth_1.ensureAuthorized)(request);
        const workflowId = request.params.workflowId;
        if (!workflowId) {
            return (0, httpResponses_1.badRequestResponse)('Workflow ID is required');
        }
        const body = (await request.json());
        context.log('Adding step to workflow', { workflowId, stepName: body.step?.name });
        const validatedRequest = (0, validation_1.validateAddStepRequest)(body);
        const workflow = await (0, workflowRepository_1.addStep)(workflowId, validatedRequest, userContext.userId);
        context.log(`Added step to workflow ${workflowId}`);
        return (0, httpResponses_1.createdResponse)(workflow);
    }
    catch (error) {
        context.error('Error adding step', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('AddStep', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/steps',
    handler
});
//# sourceMappingURL=addStep.js.map