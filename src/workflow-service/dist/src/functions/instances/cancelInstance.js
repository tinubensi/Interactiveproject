"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
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
        const instanceId = request.params.instanceId;
        if (!instanceId) {
            return (0, httpResponses_1.badRequestResponse)('Instance ID is required');
        }
        let body = {};
        try {
            body = (await request.json());
        }
        catch {
            // Empty body is acceptable
        }
        context.log('Cancelling workflow instance', { instanceId });
        const instance = await (0, instanceRepository_1.cancelInstance)(instanceId, userContext.userId, body.reason);
        // TODO: Terminate the Durable Functions orchestrator
        return (0, httpResponses_1.successResponse)({
            instanceId: instance.instanceId,
            status: instance.status,
            message: 'Workflow instance cancelled successfully'
        });
    }
    catch (error) {
        if (error instanceof instanceRepository_1.InstanceNotFoundError) {
            return (0, httpResponses_1.notFoundResponse)('Workflow instance');
        }
        context.error('Error cancelling instance', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('CancelInstance', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instances/{instanceId}/cancel',
    handler
});
//# sourceMappingURL=cancelInstance.js.map