import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { getWorkflowVersions } from '../../lib/repositories/workflowRepository';
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
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_READ);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required');
    }

    context.log('Getting workflow versions', { workflowId });

    const versions = await getWorkflowVersions(workflowId);

    return successResponse({
      workflowId,
      versions: versions.map((v) => ({
        version: v.version,
        status: v.status,
        createdAt: v.createdAt,
        createdBy: v.createdBy,
        activatedAt: v.activatedAt,
        activatedBy: v.activatedBy
      })),
      count: versions.length
    });
  } catch (error) {
    context.error('Error getting workflow versions', error);
    return handleError(error);
  }
};

app.http('GetWorkflowVersions', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/versions',
  handler
});

