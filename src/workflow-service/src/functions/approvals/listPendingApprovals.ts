import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { jsonResponse, handleError } from '../../lib/utils/httpResponses';
import { getPendingApprovalsForUser } from '../../lib/repositories/approvalRepository';
import { ensureAuthorized, getUserFromRequest } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

const listPendingApprovalsHandler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);

    const user = getUserFromRequest(request);
    const organizationId = request.query.get('organizationId') || undefined;

    context.log(
      `Listing pending approvals for user: ${user.userId}`,
      { roles: user.roles, organizationId }
    );

    const approvals = await getPendingApprovalsForUser(
      user.userId,
      user.roles,
      organizationId
    );

    return jsonResponse(200, {
      approvals,
      count: approvals.length
    });
  } catch (error) {
    context.error('Error listing pending approvals:', error);
    return handleError(error);
  }
};

app.http('ListPendingApprovals', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'approvals/pending',
  handler: listPendingApprovalsHandler
});

