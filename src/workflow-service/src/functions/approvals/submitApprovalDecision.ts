import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { jsonResponse, handleError } from '../../lib/utils/httpResponses';
import {
  recordApprovalDecision,
  ApprovalNotFoundError,
  getApproval
} from '../../lib/repositories/approvalRepository';
import { resumeWorkflow } from '../../lib/engine/workflowOrchestrator';
import { getInstance } from '../../lib/repositories/instanceRepository';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import {
  publishWorkflowApprovalCompletedEvent
} from '../../lib/eventPublisher';
import {
  trackApprovalDecision
} from '../../lib/telemetry';
import { logApprovalDecision } from '../../lib/auditClient';
import { sendApprovalDecidedNotification } from '../../lib/notificationClient';

interface SubmitApprovalRequest {
  decision: 'approved' | 'rejected';
  comment?: string;
  data?: Record<string, unknown>;
}

const submitApprovalDecisionHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const user = await ensureAuthorized(request);
    await requirePermission(user.userId, WORKFLOW_PERMISSIONS.APPROVALS_DECIDE);

    const approvalId = request.params.approvalId;
    const body = (await request.json()) as SubmitApprovalRequest;

    if (!approvalId) {
      return jsonResponse(400, { message: 'Approval ID is required' }, request);
    }

    if (!body.decision || !['approved', 'rejected'].includes(body.decision)) {
      return jsonResponse(400, {
        message: 'Decision must be either "approved" or "rejected"'
      }, request);
    }

    context.log(`Processing approval decision for ${approvalId}:`, {
      userId: user.userId,
      decision: body.decision
    });

    // Get the approval before recording decision to calculate duration
    const approvalBefore = await getApproval(approvalId);
    const startTime = new Date(approvalBefore.requestedAt).getTime();

    // Record the decision
    const updatedApproval = await recordApprovalDecision(
      approvalId,
      user.userId,
      user.name || user.email || user.userId,
      body.decision,
      body.comment,
      body.data
    );

    // Get the instance
    const instance = await getInstance(updatedApproval.instanceId);

    // Calculate duration
    const durationMs = Date.now() - startTime;

    // Track telemetry
    trackApprovalDecision(instance, approvalId, body.decision, durationMs);

    // Publish event
    await publishWorkflowApprovalCompletedEvent(
      approvalId,
      instance,
      updatedApproval.stepId,
      body.decision,
      user.userId,
      body.comment
    );

    // Log audit event
    await logApprovalDecision(
      approvalId,
      body.decision,
      user,
      {
        workflowId: instance.workflowId,
        instanceId: instance.instanceId,
        comment: body.comment,
      }
    );

    // Send notification to requester (only if we have the initiator)
    if (instance.initiatedBy) {
      await sendApprovalDecidedNotification(
        approvalId,
        instance.initiatedBy,
        {
          approvalType: 'Workflow Approval',
          entityType: instance.workflowId,
          decision: body.decision === 'approved' ? 'Approved' : 'Rejected',
          decidedBy: user.name || user.email || user.userId,
          comments: body.comment,
        }
      );
    }

    // If approval is complete (approved or rejected), resume the workflow
    if (updatedApproval.status === 'approved' || updatedApproval.status === 'rejected') {
      context.log(
        `Approval ${approvalId} finalized with status: ${updatedApproval.status}`
      );

      // Resume workflow with approval result
      if (instance.status === 'waiting') {
        try {
          await resumeWorkflow(instance.instanceId, {
            approvalResult: {
              approvalId,
              status: updatedApproval.status,
              decisions: updatedApproval.decisions,
              data: body.data
            }
          });
          context.log(`Workflow ${instance.instanceId} resumed`);
        } catch (resumeError) {
          context.warn('Failed to resume workflow:', resumeError);
          // Don't fail the request, approval was recorded
        }
      }
    }

    return jsonResponse(200, {
      approval: updatedApproval,
      workflowResumed: instance.status === 'waiting'
    }, request);
  } catch (error) {
    context.error('Error submitting approval decision:', error);
    if (error instanceof ApprovalNotFoundError) {
      return jsonResponse(404, { message: error.message }, request);
    }
    return handleError(error, request);
  }
};

app.http('SubmitApprovalDecision', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'approvals/{approvalId}/decide',
  handler: submitApprovalDecisionHandler
});

