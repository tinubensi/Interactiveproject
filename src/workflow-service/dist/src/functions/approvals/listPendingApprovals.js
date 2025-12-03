"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const approvalRepository_1 = require("../../lib/repositories/approvalRepository");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const listPendingApprovalsHandler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        (0, auth_1.ensureAuthorized)(request);
        const user = (0, auth_1.getUserFromRequest)(request);
        const organizationId = request.query.get('organizationId') || undefined;
        context.log(`Listing pending approvals for user: ${user.userId}`, { roles: user.roles, organizationId });
        const approvals = await (0, approvalRepository_1.getPendingApprovalsForUser)(user.userId, user.roles, organizationId);
        return (0, httpResponses_1.jsonResponse)(200, {
            approvals,
            count: approvals.length
        });
    }
    catch (error) {
        context.error('Error listing pending approvals:', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ListPendingApprovals', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'approvals/pending',
    handler: listPendingApprovalsHandler
});
//# sourceMappingURL=listPendingApprovals.js.map