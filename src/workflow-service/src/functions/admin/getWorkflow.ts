import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import {
  getWorkflow,
  getWorkflowByVersion
} from '../../lib/repositories/workflowRepository';
import {
  successResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_READ);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required', undefined, request);
    }

    const versionParam = request.query.get('version');
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    context.log('Getting workflow', { workflowId, version });

    const workflow = version
      ? await getWorkflowByVersion(workflowId, version)
      : await getWorkflow(workflowId);

    return successResponse(workflow, request);
  } catch (error) {
    context.error('Error getting workflow', error);
    return handleError(error, request);
  }
};

app.http('GetWorkflow', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/details',
  handler
});

