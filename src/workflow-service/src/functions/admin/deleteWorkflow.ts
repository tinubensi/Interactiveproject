import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { deleteWorkflow } from '../../lib/repositories/workflowRepository';
import {
  noContentResponse,
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

    context.log('Deleting workflow', { workflowId });

    await deleteWorkflow(workflowId, userContext.userId);

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

