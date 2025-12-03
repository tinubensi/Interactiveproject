import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { jsonResponse, handleError } from '../../lib/utils/httpResponses';
import {
  reassignApproval,
  ApprovalNotFoundError
} from '../../lib/repositories/approvalRepository';
import { ensureAuthorized } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

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
    ensureAuthorized(request);

    const approvalId = request.params.approvalId;
    const body = (await request.json()) as ReassignApprovalRequest;

    if (!approvalId) {
      return jsonResponse(400, { message: 'Approval ID is required' });
    }

    if (!body.toUserId) {
      return jsonResponse(400, { message: 'Target user ID is required' });
    }

    context.log(`Reassigning approval ${approvalId} to ${body.toUserId}`);

    const newApproval = await reassignApproval(
      approvalId,
      body.toUserId,
      body.reason
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

