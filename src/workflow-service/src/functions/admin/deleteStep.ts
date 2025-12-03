import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { deleteStep } from '../../lib/repositories/workflowRepository';
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
    const stepId = request.params.stepId;

    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }
    if (!stepId) {
      return badRequestResponse('Step ID is required');
    }

    context.log('Deleting step', { workflowId, stepId });

    const workflow = await deleteStep(workflowId, stepId, userContext.userId);

    context.log(`Deleted step ${stepId} from workflow ${workflowId}`);
    return successResponse(workflow);
  } catch (error) {
    context.error('Error deleting step', error);
    return handleError(error);
  }
};

app.http('DeleteStep', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/steps/{stepId}',
  handler
});

