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
import { ensureAuthorized } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

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
    const userContext = ensureAuthorized(request);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }

    const body = (await request.json()) as CloneRequest;
    if (!body.name || typeof body.name !== 'string') {
      return badRequestResponse('New workflow name is required');
    }

    context.log('Cloning workflow', { sourceWorkflowId: workflowId, newName: body.name });

    const workflow = await cloneWorkflow(
      workflowId,
      body.name,
      userContext.userId
    );

    context.log(`Cloned workflow ${workflowId} to ${workflow.workflowId}`);
    return createdResponse(workflow);
  } catch (error) {
    context.error('Error cloning workflow', error);
    return handleError(error);
  }
};

app.http('CloneWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/clone',
  handler
});

