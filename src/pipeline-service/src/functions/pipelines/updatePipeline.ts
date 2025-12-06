/**
 * Update Pipeline API
 * PUT /api/pipelines/:id
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { updatePipeline, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse } from '../../utils/corsHelper';
import type { UpdatePipelineRequest } from '../../models/pipeline';

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

    const body = await request.json() as UpdatePipelineRequest;

    context.log(`Updating pipeline ${pipelineId}`);

    const pipeline = await updatePipeline(pipelineId, body, userContext.userId);

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Update pipeline error:', error);
    return errorResponse(request, error.message || 'Failed to update pipeline', 500);
  }
}

app.http('UpdatePipeline', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/update',
  handler,
});

