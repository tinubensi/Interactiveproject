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
        context.log('Deleting workflow', { workflowId });
        await (0, workflowRepository_1.deleteWorkflow)(workflowId, userContext.userId);
        context.log(`Deleted workflow ${workflowId}`);
        return (0, httpResponses_1.noContentResponse)();
    }
    catch (error) {
        context.error('Error deleting workflow', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('DeleteWorkflow', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}',
    handler
});
//# sourceMappingURL=deleteWorkflow.js.map