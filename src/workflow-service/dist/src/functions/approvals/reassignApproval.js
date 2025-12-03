"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const approvalRepository_1 = require("../../lib/repositories/approvalRepository");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const reassignApprovalHandler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        (0, auth_1.ensureAuthorized)(request);
        const approvalId = request.params.approvalId;
        const body = (await request.json());
        if (!approvalId) {
            return (0, httpResponses_1.jsonResponse)(400, { message: 'Approval ID is required' });
        }
        if (!body.toUserId) {
            return (0, httpResponses_1.jsonResponse)(400, { message: 'Target user ID is required' });
        }
        context.log(`Reassigning approval ${approvalId} to ${body.toUserId}`);
        const newApproval = await (0, approvalRepository_1.reassignApproval)(approvalId, body.toUserId, body.reason);
        return (0, httpResponses_1.jsonResponse)(200, {
            message: 'Approval reassigned successfully',
            newApprovalId: newApproval.approvalId,
            approval: newApproval
        });
    }
    catch (error) {
        context.error('Error reassigning approval:', error);
        if (error instanceof approvalRepository_1.ApprovalNotFoundError) {
            return (0, httpResponses_1.jsonResponse)(404, { message: error.message });
        }
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ReassignApproval', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'approvals/{approvalId}/reassign',
    handler: reassignApprovalHandler
});
//# sourceMappingURL=reassignApproval.js.map