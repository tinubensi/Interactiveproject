import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { reorderSteps } from '../../lib/repositories/workflowRepository';
import {
  successResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { ReorderStepsRequest } from '../../models/workflowTypes';

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
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }

    const body = (await request.json()) as ReorderStepsRequest;
    if (!body.stepOrder || !Array.isArray(body.stepOrder)) {
      return badRequestResponse('stepOrder array is required');
    }

    context.log('Reordering steps', { workflowId, count: body.stepOrder.length });

    const workflow = await reorderSteps(workflowId, body, userContext.userId);

    context.log(`Reordered steps in workflow ${workflowId}`);
    return successResponse(workflow);
  } catch (error) {
    context.error('Error reordering steps', error);
    return handleError(error);
  }
};

app.http('ReorderSteps', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/steps/reorder',
  handler
});

