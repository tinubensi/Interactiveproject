/**
 * Reorder Steps API
 * PUT /api/pipelines/:id/steps/reorder
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { reorderSteps, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse, badRequestResponse } from '../../utils/corsHelper';
import type { ReorderStepsRequest } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.PIPELINES_UPDATE);

    const pipelineId = request.params.id;
    if (!pipelineId) {
      return errorResponse(request, 'Pipeline ID is required', 400);
    }

    const body = await request.json() as ReorderStepsRequest;

    if (!body.stepOrder || !Array.isArray(body.stepOrder)) {
      return badRequestResponse(request, 'stepOrder array is required');
    }

    context.log(`Reordering steps in pipeline ${pipelineId}`);

    const pipeline = await reorderSteps(pipelineId, body.stepOrder, userContext.userId);

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Reorder steps error:', error);
    return errorResponse(request, error.message || 'Failed to reorder steps', 500);
  }
}

app.http('ReorderSteps', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/steps/reorder',
  handler,
});

