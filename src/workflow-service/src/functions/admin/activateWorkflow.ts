import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { activateWorkflow } from '../../lib/repositories/workflowRepository';
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

    const body = (await request.json().catch(() => ({}))) as {
      version?: number;
    };

    context.log('Activating workflow', { workflowId, version: body.version });

    const workflow = await activateWorkflow(
      workflowId,
      userContext.userId,
      body.version
    );

    // Log audit event
    await logAuditEvent(
      WORKFLOW_AUDIT_EVENTS.WORKFLOW_ACTIVATED,
      'update',
      'workflow',
      workflowId,
      userContext,
      { version: workflow.version }
    );

    context.log(`Activated workflow ${workflowId} version ${workflow.version}`);
    return successResponse(workflow, request);
  } catch (error) {
    context.error('Error activating workflow', error);
    return handleError(error, request);
  }
};

app.http('ActivateWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/activate',
  handler
});

