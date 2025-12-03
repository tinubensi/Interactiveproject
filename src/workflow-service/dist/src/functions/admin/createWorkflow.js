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
        const body = (await request.json());
        context.log('Creating workflow', { name: body.name });
        const validatedRequest = (0, validation_1.validateCreateWorkflowRequest)(body);
        const workflow = await (0, workflowRepository_1.createWorkflow)(validatedRequest, userContext.userId);
        context.log(`Created workflow ${workflow.workflowId}`);
        return (0, httpResponses_1.createdResponse)(workflow);
    }
    catch (error) {
        context.error('Error creating workflow', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('CreateWorkflow', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows',
    handler
});
//# sourceMappingURL=createWorkflow.js.map