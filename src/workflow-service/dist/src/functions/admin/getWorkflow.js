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
        (0, auth_1.ensureAuthorized)(request);
        const workflowId = request.params.workflowId;
        if (!workflowId) {
            return (0, httpResponses_1.badRequestResponse)('Workflow ID is required');
        }
        const versionParam = request.query.get('version');
        const version = versionParam ? parseInt(versionParam, 10) : undefined;
        context.log('Getting workflow', { workflowId, version });
        const workflow = version
            ? await (0, workflowRepository_1.getWorkflowByVersion)(workflowId, version)
            : await (0, workflowRepository_1.getWorkflow)(workflowId);
        return (0, httpResponses_1.successResponse)(workflow);
    }
    catch (error) {
        context.error('Error getting workflow', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('GetWorkflow', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/details',
    handler
});
//# sourceMappingURL=getWorkflow.js.map