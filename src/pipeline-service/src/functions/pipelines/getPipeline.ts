/**
 * Get Pipeline API
 * GET /api/pipelines/:id
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getPipeline, PipelineNotFoundError } from '../../repositories/pipelineRepository';
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
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.PIPELINES_READ);

    const pipelineId = request.params.id;
    if (!pipelineId) {
      return errorResponse(request, 'Pipeline ID is required', 400);
    }

    const pipeline = await getPipeline(pipelineId);

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Get pipeline error:', error);
    return errorResponse(request, error.message || 'Failed to get pipeline', 500);
  }
}

app.http('GetPipeline', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}',
  handler,
});

