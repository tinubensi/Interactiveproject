import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { saveCanvas } from '../../lib/repositories/canvasRepository';
import { successResponse, handleError, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import { getUserFromRequest } from '../../lib/utils/auth';
import type { SaveCanvasRequest } from '../../models/workflowTypes';

export async function saveCanvasHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const user = await getUserFromRequest(request);
    const workflowId = request.params.workflowId;

    if (!workflowId) {
      return withCors(badRequestResponse('Workflow ID is required'));
    }

    const body = (await request.json()) as SaveCanvasRequest;

    // Validate request body
    if (!body.nodePositions || typeof body.nodePositions !== 'object') {
      return withCors(badRequestResponse('nodePositions is required'));
    }

    if (!body.viewport) {
      return withCors(badRequestResponse('viewport is required'));
    }

    const canvas = await saveCanvas(workflowId, body, user.userId);

    telemetry?.trackEvent('CanvasSaved', {
      workflowId,
      version: String(canvas.version),
      nodeCount: String(Object.keys(body.nodePositions).length),
      savedBy: user.userId,
    });

    telemetry?.trackMetric('canvas.save.duration', Date.now() - startTime);

    return withCors(successResponse(canvas));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'saveCanvas',
      workflowId: request.params.workflowId,
    });
    return withCors(handleError(error));
  }
}

app.http('saveCanvas', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/canvas/save',
  handler: saveCanvasHandler,
});

