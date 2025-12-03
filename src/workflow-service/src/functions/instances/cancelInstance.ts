import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import {
  cancelInstance,
  InstanceNotFoundError
} from '../../lib/repositories/instanceRepository';
import {
  successResponse,
  handleError,
  badRequestResponse,
  notFoundResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';

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
    const userContext = ensureAuthorized(request);

    const instanceId = request.params.instanceId;
    if (!instanceId) {
      return badRequestResponse('Instance ID is required');
    }

    let body: CancelRequest = {};
    try {
      body = (await request.json()) as CancelRequest;
    } catch {
      // Empty body is acceptable
    }

    context.log('Cancelling workflow instance', { instanceId });

    const instance = await cancelInstance(
      instanceId,
      userContext.userId,
      body.reason
    );

    // TODO: Terminate the Durable Functions orchestrator

    return successResponse({
      instanceId: instance.instanceId,
      status: instance.status,
      message: 'Workflow instance cancelled successfully'
    });
  } catch (error) {
    if (error instanceof InstanceNotFoundError) {
      return notFoundResponse('Workflow instance');
    }
    context.error('Error cancelling instance', error);
    return handleError(error);
  }
};

app.http('CancelInstance', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/{instanceId}/cancel',
  handler
});

