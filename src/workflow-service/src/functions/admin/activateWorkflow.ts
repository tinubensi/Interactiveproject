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
import { ensureAuthorized } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = ensureAuthorized(request);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
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

    context.log(`Activated workflow ${workflowId} version ${workflow.version}`);
    return successResponse(workflow);
  } catch (error) {
    context.error('Error activating workflow', error);
    return handleError(error);
  }
};

app.http('ActivateWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/activate',
  handler
});

