import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { deactivateWorkflow } from '../../lib/repositories/workflowRepository';
import {
  successResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { logAuditEvent, WORKFLOW_AUDIT_EVENTS } from '../../lib/auditClient';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_MANAGE);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required', undefined, request);
    }

    context.log('Deactivating workflow', { workflowId });

    const workflow = await deactivateWorkflow(workflowId, userContext.userId);

    // Log audit event
    await logAuditEvent(
      WORKFLOW_AUDIT_EVENTS.WORKFLOW_DEACTIVATED,
      'update',
      'workflow',
      workflowId,
      userContext
    );

    context.log(`Deactivated workflow ${workflowId}`);
    return successResponse(workflow, request);
  } catch (error) {
    context.error('Error deactivating workflow', error);
    return handleError(error, request);
  }
};

app.http('DeactivateWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/deactivate',
  handler
});

