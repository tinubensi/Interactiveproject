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
        context.log('Getting workflow instance', { instanceId });
        const instance = await (0, instanceRepository_1.getInstance)(instanceId);
        return (0, httpResponses_1.successResponse)(instance);
    }
    catch (error) {
        if (error instanceof instanceRepository_1.InstanceNotFoundError) {
            return (0, httpResponses_1.notFoundResponse)('Workflow instance');
        }
        context.error('Error getting instance', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('GetInstance', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instances/{instanceId}',
    handler
});
//# sourceMappingURL=getInstance.js.map