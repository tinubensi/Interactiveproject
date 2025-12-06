import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getCanvas } from '../../lib/repositories/canvasRepository';
import { successResponse, handleError, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';

export async function getCanvasHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_READ);

    const workflowId = request.params.workflowId;

    if (!workflowId) {
      return withCors(request, badRequestResponse('Workflow ID is required', undefined, request));
    }

    const canvas = await getCanvas(workflowId);

    telemetry?.trackEvent('CanvasRetrieved', {
      workflowId,
      found: String(canvas !== null),
    });

    telemetry?.trackMetric('canvas.get.duration', Date.now() - startTime);

    return withCors(request, successResponse(canvas, request));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'getCanvas',
      workflowId: request.params.workflowId,
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('getCanvas', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/canvas',
  handler: getCanvasHandler,
});

