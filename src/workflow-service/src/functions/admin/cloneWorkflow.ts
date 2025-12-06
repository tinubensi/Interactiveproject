import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { cloneWorkflow } from '../../lib/repositories/workflowRepository';
import {
  createdResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { logAuditEvent, WORKFLOW_AUDIT_EVENTS } from '../../lib/auditClient';

interface CloneRequest {
  name: string;
}

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_CREATE);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required', undefined, request);
    }

    const body = (await request.json()) as CloneRequest;
    if (!body.name || typeof body.name !== 'string') {
      return badRequestResponse('New workflow name is required', undefined, request);
    }

    context.log('Cloning workflow', { sourceWorkflowId: workflowId, newName: body.name });

    const workflow = await cloneWorkflow(
      workflowId,
      body.name,
      userContext.userId
    );

    // Log audit event
    await logAuditEvent(
      WORKFLOW_AUDIT_EVENTS.WORKFLOW_CLONED,
      'create',
      'workflow',
      workflow.workflowId,
      userContext,
      { sourceWorkflowId: workflowId, clonedName: body.name }
    );

    context.log(`Cloned workflow ${workflowId} to ${workflow.workflowId}`);
    return createdResponse(workflow, request);
  } catch (error) {
    context.error('Error cloning workflow', error);
    return handleError(error, request);
  }
};

app.http('CloneWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/clone',
  handler
});

