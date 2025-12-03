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
        (0, auth_1.ensureAuthorized)(request);
        const instanceId = request.params.instanceId;
        if (!instanceId) {
            return (0, httpResponses_1.badRequestResponse)('Instance ID is required');
        }
        context.log('Getting instance logs', { instanceId });
        const logs = await (0, instanceRepository_1.getInstanceLogs)(instanceId);
        return (0, httpResponses_1.successResponse)({
            instanceId,
            logs,
            count: logs.length
        });
    }
    catch (error) {
        if (error instanceof instanceRepository_1.InstanceNotFoundError) {
            return (0, httpResponses_1.notFoundResponse)('Workflow instance');
        }
        context.error('Error getting instance logs', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('GetInstanceLogs', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instances/{instanceId}/logs',
    handler
});
//# sourceMappingURL=getInstanceLogs.js.map