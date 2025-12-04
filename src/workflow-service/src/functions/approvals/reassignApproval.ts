import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { jsonResponse, handleError } from '../../lib/utils/httpResponses';
import {
  reassignApproval,
  ApprovalNotFoundError,
  getApproval
} from '../../lib/repositories/approvalRepository';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { logApprovalReassigned } from '../../lib/auditClient';
import { sendApprovalRequiredNotification } from '../../lib/notificationClient';

interface ReassignApprovalRequest {
  toUserId: string;
  reason?: string;
}

const reassignApprovalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.APPROVALS_REASSIGN);

    const approvalId = request.params.approvalId;
    const body = (await request.json()) as ReassignApprovalRequest;

    if (!approvalId) {
      return jsonResponse(400, { message: 'Approval ID is required' });
    }

    if (!body.toUserId) {
      return jsonResponse(400, { message: 'Target user ID is required' });
    }

    // Get original approval for audit
    const originalApproval = await getApproval(approvalId);

    context.log(`Reassigning approval ${approvalId} to ${body.toUserId}`);

    const newApproval = await reassignApproval(
      approvalId,
      body.toUserId,
      body.reason
    );

    // Log audit event - use first approverUser or 'system' as original assignee
    const originalAssignee = originalApproval.approverUsers?.[0] || 'system';
    await logApprovalReassigned(
      approvalId,
      originalAssignee,
      body.toUserId,
      userContext,
      body.reason
    );

    // Send notification to new assignee
    await sendApprovalRequiredNotification(
      newApproval.approvalId,
      [body.toUserId],
      {
        approvalType: 'Workflow Approval',
        requesterName: 'System',
        entityType: newApproval.workflowId,
      }
    );

    return jsonResponse(200, {
      message: 'Approval reassigned successfully',
      newApprovalId: newApproval.approvalId,
      approval: newApproval
    });
  } catch (error) {
    context.error('Error reassigning approval:', error);
    if (error instanceof ApprovalNotFoundError) {
      return jsonResponse(404, { message: error.message });
    }
    return handleError(error);
  }
};

app.http('ReassignApproval', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'approvals/{approvalId}/reassign',
  handler: reassignApprovalHandler
});

