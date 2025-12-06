/**
 * Update Step API
 * PUT /api/pipelines/:id/steps/:stepId
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { updateStep, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse } from '../../utils/corsHelper';
import type { UpdateStepRequest } from '../../models/pipeline';

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
    const stepId = request.params.stepId;

    if (!pipelineId) {
      return errorResponse(request, 'Pipeline ID is required', 400);
    }

    if (!stepId) {
      return errorResponse(request, 'Step ID is required', 400);
    }

    const body = await request.json() as UpdateStepRequest;

    context.log(`Updating step ${stepId} in pipeline ${pipelineId}`);

    const pipeline = await updateStep(pipelineId, stepId, body, userContext.userId);

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    if (error.message?.includes('Step not found')) {
      return notFoundResponse(request, 'Step');
    }
    context.error('Update step error:', error);
    return errorResponse(request, error.message || 'Failed to update step', 500);
  }
}

app.http('UpdateStep', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/steps/{stepId}',
  handler,
});

