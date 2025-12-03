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
        context.log('Getting workflow versions', { workflowId });
        const versions = await (0, workflowRepository_1.getWorkflowVersions)(workflowId);
        return (0, httpResponses_1.successResponse)({
            workflowId,
            versions: versions.map((v) => ({
                version: v.version,
                status: v.status,
                createdAt: v.createdAt,
                createdBy: v.createdBy,
                activatedAt: v.activatedAt,
                activatedBy: v.activatedBy
            })),
            count: versions.length
        });
    }
    catch (error) {
        context.error('Error getting workflow versions', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('GetWorkflowVersions', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/versions',
    handler
});
//# sourceMappingURL=getWorkflowVersions.js.map