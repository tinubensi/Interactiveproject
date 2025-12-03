"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const approvalRepository_1 = require("../../lib/repositories/approvalRepository");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const getApprovalHandler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        (0, auth_1.ensureAuthorized)(request);
        const approvalId = request.params.approvalId;
        if (!approvalId) {
            return (0, httpResponses_1.jsonResponse)(400, { message: 'Approval ID is required' });
        }
        context.log(`Getting approval: ${approvalId}`);
        const approval = await (0, approvalRepository_1.getApproval)(approvalId);
        return (0, httpResponses_1.jsonResponse)(200, approval);
    }
    catch (error) {
        context.error('Error getting approval:', error);
        if (error instanceof approvalRepository_1.ApprovalNotFoundError) {
            return (0, httpResponses_1.jsonResponse)(404, { message: error.message });
        }
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('GetApproval', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'approvals/{approvalId}',
    handler: getApprovalHandler
});
//# sourceMappingURL=getApproval.js.map