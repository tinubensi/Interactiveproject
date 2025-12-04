import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import {
  getInstance,
  InstanceNotFoundError
} from '../../lib/repositories/instanceRepository';
import {
  successResponse,
  handleError,
  badRequestResponse,
  notFoundResponse
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

    const instanceId = request.params.instanceId;
    if (!instanceId) {
      return badRequestResponse('Instance ID is required');
    }

    context.log('Getting workflow instance', { instanceId });

    const instance = await getInstance(instanceId);

    return successResponse(instance);
  } catch (error) {
    if (error instanceof InstanceNotFoundError) {
      return notFoundResponse('Workflow instance');
    }
    context.error('Error getting instance', error);
    return handleError(error);
  }
};

app.http('GetInstance', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/{instanceId}',
  handler
});

