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

export async function getCanvasHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const workflowId = request.params.workflowId;

    if (!workflowId) {
      return withCors(badRequestResponse('Workflow ID is required'));
    }

    const canvas = await getCanvas(workflowId);

    telemetry?.trackEvent('CanvasRetrieved', {
      workflowId,
      found: String(canvas !== null),
    });

    telemetry?.trackMetric('canvas.get.duration', Date.now() - startTime);

    return withCors(successResponse(canvas));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'getCanvas',
      workflowId: request.params.workflowId,
    });
    return withCors(handleError(error));
  }
}

app.http('getCanvas', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/canvas',
  handler: getCanvasHandler,
});

