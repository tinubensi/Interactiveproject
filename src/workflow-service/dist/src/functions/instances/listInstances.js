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
        const filters = {
            organizationId: request.query.get('organizationId') || userContext.organizationId,
            workflowId: request.query.get('workflowId') || undefined,
            status: request.query.get('status'),
            correlationId: request.query.get('correlationId') || undefined,
            initiatedBy: request.query.get('initiatedBy') || undefined,
            startDateFrom: request.query.get('startDateFrom') || undefined,
            startDateTo: request.query.get('startDateTo') || undefined
        };
        context.log('Listing workflow instances', filters);
        const instances = await (0, instanceRepository_1.listInstances)(filters);
        return (0, httpResponses_1.successResponse)({
            instances: instances.map((inst) => ({
                instanceId: inst.instanceId,
                workflowId: inst.workflowId,
                workflowName: inst.workflowName,
                workflowVersion: inst.workflowVersion,
                status: inst.status,
                triggerType: inst.triggerType,
                currentStepId: inst.currentStepId,
                correlationId: inst.correlationId,
                createdAt: inst.createdAt,
                startedAt: inst.startedAt,
                completedAt: inst.completedAt,
                initiatedBy: inst.initiatedBy,
                errorCount: inst.errorCount
            })),
            count: instances.length
        });
    }
    catch (error) {
        context.error('Error listing instances', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ListInstances', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'instances',
    handler
});
//# sourceMappingURL=listInstances.js.map