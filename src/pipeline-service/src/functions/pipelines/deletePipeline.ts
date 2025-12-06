/**
 * Delete Pipeline API
 * DELETE /api/pipelines/:id
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deletePipeline, PipelineNotFoundError } from '../../repositories/pipelineRepository';
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
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.PIPELINES_DELETE);

    const pipelineId = request.params.id;
    if (!pipelineId) {
      return errorResponse(request, 'Pipeline ID is required', 400);
    }

    context.log(`Deleting pipeline ${pipelineId}`);

    await deletePipeline(pipelineId, userContext.userId);

    return successResponse(request, { message: 'Pipeline deleted successfully' });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Delete pipeline error:', error);
    return errorResponse(request, error.message || 'Failed to delete pipeline', 500);
  }
}

app.http('DeletePipeline', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/delete',
  handler,
});

