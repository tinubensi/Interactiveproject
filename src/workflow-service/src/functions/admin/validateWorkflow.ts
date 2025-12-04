import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { getWorkflow } from '../../lib/repositories/workflowRepository';
import {
  successResponse,
  handleError,
  badRequestResponse
} from '../../lib/utils/httpResponses';
import { validateWorkflowIntegrity } from '../../lib/validation';
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
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_READ);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }

    context.log('Validating workflow', { workflowId });

    const workflow = await getWorkflow(workflowId);
    const validation = validateWorkflowIntegrity(workflow);

    return successResponse({
      workflowId,
      version: workflow.version,
      valid: validation.valid,
      errors: validation.errors,
      canActivate: validation.valid && workflow.steps.length > 0
    });
  } catch (error) {
    context.error('Error validating workflow', error);
    return handleError(error);
  }
};

app.http('ValidateWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/validate',
  handler
});

