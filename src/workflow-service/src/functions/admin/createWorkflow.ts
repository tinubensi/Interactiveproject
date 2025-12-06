import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { createWorkflow } from '../../lib/repositories/workflowRepository';
import {
  createdResponse,
  handleError
} from '../../lib/utils/httpResponses';
import { validateCreateWorkflowRequest } from '../../lib/validation';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { CreateWorkflowRequest } from '../../models/workflowTypes';
import { logWorkflowCreated } from '../../lib/auditClient';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_CREATE);

    const body = (await request.json()) as CreateWorkflowRequest;

    context.log('Creating workflow', { name: body.name });

    const validatedRequest = validateCreateWorkflowRequest(body);
    const workflow = await createWorkflow(validatedRequest, userContext.userId);

    // Log audit event
    await logWorkflowCreated(workflow.workflowId, workflow.name, userContext);

    context.log(`Created workflow ${workflow.workflowId}`);
    return createdResponse(workflow, request);
  } catch (error) {
    context.error('Error creating workflow', error);
    return handleError(error, request);
  }
};

app.http('CreateWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows',
  handler
});

