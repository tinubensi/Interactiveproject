import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { addStep } from '../../lib/repositories/workflowRepository';
import {
  createdResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { validateAddStepRequest } from '../../lib/validation';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { AddStepRequest } from '../../models/workflowTypes';

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
      return badRequestResponse('Workflow ID is required', undefined, request);
    }

    const body = (await request.json()) as AddStepRequest;
    context.log('Adding step to workflow', { workflowId, stepName: body.step?.name });

    const validatedRequest = validateAddStepRequest(body);
    const workflow = await addStep(workflowId, validatedRequest, userContext.userId);

    context.log(`Added step to workflow ${workflowId}`);
    return createdResponse(workflow, request);
  } catch (error) {
    context.error('Error adding step', error);
    return handleError(error, request);
  }
};

app.http('AddStep', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/steps',
  handler
});

