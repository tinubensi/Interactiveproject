"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const approvalRepository_1 = require("../../lib/repositories/approvalRepository");
const workflowOrchestrator_1 = require("../../lib/engine/workflowOrchestrator");
const instanceRepository_1 = require("../../lib/repositories/instanceRepository");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const eventPublisher_1 = require("../../lib/eventPublisher");
const telemetry_1 = require("../../lib/telemetry");
const submitApprovalDecisionHandler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        (0, auth_1.ensureAuthorized)(request);
        const approvalId = request.params.approvalId;
        const user = (0, auth_1.getUserFromRequest)(request);
        const body = (await request.json());
        if (!approvalId) {
            return (0, httpResponses_1.jsonResponse)(400, { message: 'Approval ID is required' });
        }
        if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
            return (0, httpResponses_1.jsonResponse)(400, {
                message: 'Decision must be either "approved" or "rejected"'
            });
        }
        context.log(`Processing approval decision for ${approvalId}:`, {
            userId: user.userId,
            decision: body.decision
        });
        // Get the approval before recording decision to calculate duration
        const approvalBefore = await (0, approvalRepository_1.getApproval)(approvalId);
        const startTime = new Date(approvalBefore.requestedAt).getTime();
        // Record the decision
        const updatedApproval = await (0, approvalRepository_1.recordApprovalDecision)(approvalId, user.userId, user.userName, body.decision, body.comment, body.data);
        // Get the instance
        const instance = await (0, instanceRepository_1.getInstance)(updatedApproval.instanceId);
        // Calculate duration
        const durationMs = Date.now() - startTime;
        // Track telemetry
        (0, telemetry_1.trackApprovalDecision)(instance, approvalId, body.decision, durationMs);
        // Publish event
        await (0, eventPublisher_1.publishWorkflowApprovalCompletedEvent)(approvalId, instance, updatedApproval.stepId, body.decision, user.userId, body.comment);
        // If approval is complete (approved or rejected), resume the workflow
        if (updatedApproval.status === 'approved' || updatedApproval.status === 'rejected') {
            context.log(`Approval ${approvalId} finalized with status: ${updatedApproval.status}`);
            // Resume workflow with approval result
            if (instance.status === 'waiting') {
                try {
                    await (0, workflowOrchestrator_1.resumeWorkflow)(instance.instanceId, {
                        approvalResult: {
                            approvalId,
                            status: updatedApproval.status,
                            decisions: updatedApproval.decisions,
                            data: body.data
                        }
                    });
                    context.log(`Workflow ${instance.instanceId} resumed`);
                }
                catch (resumeError) {
                    context.warn('Failed to resume workflow:', resumeError);
                    // Don't fail the request, approval was recorded
                }
            }
        }
        return (0, httpResponses_1.jsonResponse)(200, {
            approval: updatedApproval,
            workflowResumed: instance.status === 'waiting'
        });
    }
    catch (error) {
        context.error('Error submitting approval decision:', error);
        if (error instanceof approvalRepository_1.ApprovalNotFoundError) {
            return (0, httpResponses_1.jsonResponse)(404, { message: error.message });
        }
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('SubmitApprovalDecision', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'approvals/{approvalId}/decide',
    handler: submitApprovalDecisionHandler
});
//# sourceMappingURL=submitApprovalDecision.js.map