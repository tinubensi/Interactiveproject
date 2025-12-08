/**
 * Delete Step API
 * DELETE /api/pipelines/:id/steps/:stepId
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deleteStep, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse } from '../../utils/corsHelper';

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

    context.log(`Deleting step ${stepId} from pipeline ${pipelineId}`);

    const pipeline = await deleteStep(pipelineId, stepId, userContext.userId);

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Delete step error:', error);
    return errorResponse(request, error.message || 'Failed to delete step', 500);
  }
}

app.http('DeleteStep', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/steps/{stepId}/delete',
  handler,
});

