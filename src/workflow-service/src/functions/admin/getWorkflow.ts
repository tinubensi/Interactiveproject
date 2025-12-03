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
import { ensureAuthorized } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    ensureAuthorized(request);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }

    const versionParam = request.query.get('version');
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    context.log('Getting workflow', { workflowId, version });

    const workflow = version
      ? await getWorkflowByVersion(workflowId, version)
      : await getWorkflow(workflowId);

    return successResponse(workflow);
  } catch (error) {
    context.error('Error getting workflow', error);
    return handleError(error);
  }
};

app.http('GetWorkflow', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/details',
  handler
});

