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
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_UPDATE);

    const workflowId = request.params.workflowId;
    const stepId = request.params.stepId;

    if (!workflowId) {
      return badRequestResponse('Workflow ID is required', undefined, request);
    }
    if (!stepId) {
      return badRequestResponse('Step ID is required', undefined, request);
    }

    context.log('Deleting step', { workflowId, stepId });

    const workflow = await deleteStep(workflowId, stepId, userContext.userId);

    context.log(`Deleted step ${stepId} from workflow ${workflowId}`);
    return successResponse(workflow, request);
  } catch (error) {
    context.error('Error deleting step', error);
    return handleError(error, request);
  }
};

app.http('DeleteStep', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/steps/{stepId}',
  handler
});

