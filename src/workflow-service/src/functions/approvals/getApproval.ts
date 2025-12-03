import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { jsonResponse, handleError } from '../../lib/utils/httpResponses';
import { getApproval, ApprovalNotFoundError } from '../../lib/repositories/approvalRepository';
import { ensureAuthorized } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

const getApprovalHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);

    const approvalId = request.params.approvalId;

    if (!approvalId) {
      return jsonResponse(400, { message: 'Approval ID is required' });
    }

    context.log(`Getting approval: ${approvalId}`);

    const approval = await getApproval(approvalId);

    return jsonResponse(200, approval);
  } catch (error) {
    context.error('Error getting approval:', error);
    if (error instanceof ApprovalNotFoundError) {
      return jsonResponse(404, { message: error.message });
    }
    return handleError(error);
  }
};

app.http('GetApproval', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'approvals/{approvalId}',
  handler: getApprovalHandler
});

