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
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
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
    const user = await ensureAuthorized(request);
    await requirePermission(user.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_UPDATE);

    const workflowId = request.params.workflowId;

    if (!workflowId) {
      return withCors(request, badRequestResponse('Workflow ID is required', undefined, request));
    }

    const body = (await request.json()) as SaveCanvasRequest;

    // Validate request body
    if (!body.nodePositions || typeof body.nodePositions !== 'object') {
      return withCors(request, badRequestResponse('nodePositions is required', undefined, request));
    }

    if (!body.viewport) {
      return withCors(request, badRequestResponse('viewport is required', undefined, request));
    }

    const canvas = await saveCanvas(workflowId, body, user.userId);

    telemetry?.trackEvent('CanvasSaved', {
      workflowId,
      version: String(canvas.version),
      nodeCount: String(Object.keys(body.nodePositions).length),
      savedBy: user.userId,
    });

    telemetry?.trackMetric('canvas.save.duration', Date.now() - startTime);

    return withCors(request, successResponse(canvas, request));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'saveCanvas',
      workflowId: request.params.workflowId,
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('saveCanvas', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/canvas/save',
  handler: saveCanvasHandler,
});

