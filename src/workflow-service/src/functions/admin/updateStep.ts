import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { updateStep } from '../../lib/repositories/workflowRepository';
import {
  successResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { WorkflowStep } from '../../models/workflowTypes';

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
      return badRequestResponse('Workflow ID is required');
    }
    if (!stepId) {
      return badRequestResponse('Step ID is required');
    }

    const body = (await request.json()) as Partial<Omit<WorkflowStep, 'id'>>;
    context.log('Updating step', { workflowId, stepId });

    const workflow = await updateStep(
      workflowId,
      stepId,
      body,
      userContext.userId
    );

    context.log(`Updated step ${stepId} in workflow ${workflowId}`);
    return successResponse(workflow);
  } catch (error) {
    context.error('Error updating step', error);
    return handleError(error);
  }
};

app.http('UpdateStep', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/steps/{stepId}/update',
  handler
});

