import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { deleteWorkflow, getWorkflow } from '../../lib/repositories/workflowRepository';
import {
  noContentResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { logWorkflowDeleted } from '../../lib/auditClient';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_DELETE);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }

    context.log('Deleting workflow', { workflowId });

    // Get workflow name for audit
    const workflow = await getWorkflow(workflowId);

    await deleteWorkflow(workflowId, userContext.userId);

    // Log audit event
    await logWorkflowDeleted(workflowId, workflow.name, userContext);

    context.log(`Deleted workflow ${workflowId}`);
    return noContentResponse();
  } catch (error) {
    context.error('Error deleting workflow', error);
    return handleError(error);
  }
};

app.http('DeleteWorkflow', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}',
  handler
});

