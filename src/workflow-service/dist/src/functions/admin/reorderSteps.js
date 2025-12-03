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
        const body = (await request.json());
        if (!body.stepOrder || !Array.isArray(body.stepOrder)) {
            return (0, httpResponses_1.badRequestResponse)('stepOrder array is required');
        }
        context.log('Reordering steps', { workflowId, count: body.stepOrder.length });
        const workflow = await (0, workflowRepository_1.reorderSteps)(workflowId, body, userContext.userId);
        context.log(`Reordered steps in workflow ${workflowId}`);
        return (0, httpResponses_1.successResponse)(workflow);
    }
    catch (error) {
        context.error('Error reordering steps', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ReorderSteps', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/steps/reorder',
    handler
});
//# sourceMappingURL=reorderSteps.js.map