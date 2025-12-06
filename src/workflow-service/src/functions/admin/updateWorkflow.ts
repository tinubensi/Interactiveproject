import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { updateWorkflow } from '../../lib/repositories/workflowRepository';
import {
  successResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { validateUpdateWorkflowRequest } from '../../lib/validation';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { UpdateWorkflowRequest } from '../../models/workflowTypes';
import { logWorkflowUpdated } from '../../lib/auditClient';

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

    const body = (await request.json()) as UpdateWorkflowRequest;
    context.log('Updating workflow', { workflowId });

    const validatedRequest = validateUpdateWorkflowRequest(body);
    const workflow = await updateWorkflow(
      workflowId,
      validatedRequest,
      userContext.userId
    );

    // Log audit event
    await logWorkflowUpdated(workflowId, userContext);

    context.log(`Updated workflow ${workflowId} to version ${workflow.version}`);
    return successResponse(workflow, request);
  } catch (error) {
    context.error('Error updating workflow', error);
    return handleError(error, request);
  }
};

app.http('UpdateWorkflow', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/update',
  handler
});

