import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import {
  cancelInstance,
  InstanceNotFoundError,
  getInstance
} from '../../lib/repositories/instanceRepository';
import {
  successResponse,
  handleError,
  badRequestResponse,
  notFoundResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { logInstanceCancelled } from '../../lib/auditClient';

interface CancelRequest {
  reason?: string;
}

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_EXECUTE);

    const instanceId = request.params.instanceId;
    if (!instanceId) {
      return badRequestResponse('Instance ID is required', undefined, request);
    }

    let body: CancelRequest = {};
    try {
      body = (await request.json()) as CancelRequest;
    } catch {
      // Empty body is acceptable
    }

    context.log('Cancelling workflow instance', { instanceId });

    // Get instance info before cancelling
    const instanceBefore = await getInstance(instanceId);

    const instance = await cancelInstance(
      instanceId,
      userContext.userId,
      body.reason
    );

    // Log audit event
    await logInstanceCancelled(instanceId, instanceBefore.workflowId, userContext, body.reason);

    // TODO: Terminate the Durable Functions orchestrator

    return successResponse({
      instanceId: instance.instanceId,
      status: instance.status,
      message: 'Workflow instance cancelled successfully'
    }, request);
  } catch (error) {
    if (error instanceof InstanceNotFoundError) {
      return notFoundResponse('Workflow instance', request);
    }
    context.error('Error cancelling instance', error);
    return handleError(error, request);
  }
};

app.http('CancelInstance', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/{instanceId}/cancel',
  handler
});

