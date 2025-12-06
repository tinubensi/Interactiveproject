/**
 * Deactivate Pipeline API
 * POST /api/pipelines/:id/deactivate
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deactivatePipeline, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse } from '../../utils/corsHelper';
import { publishPipelineDeactivated } from '../../services/eventGridService';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.PIPELINES_ACTIVATE);

    const pipelineId = request.params.id;
    if (!pipelineId) {
      return errorResponse(request, 'Pipeline ID is required', 400);
    }

    context.log(`Deactivating pipeline ${pipelineId}`);

    const pipeline = await deactivatePipeline(pipelineId, userContext.userId);

    // Publish deactivation event
    await publishPipelineDeactivated({
      pipelineId: pipeline.pipelineId,
      lineOfBusiness: pipeline.lineOfBusiness,
      deactivatedBy: userContext.userId,
    });

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Deactivate pipeline error:', error);
    return errorResponse(request, error.message || 'Failed to deactivate pipeline', 500);
  }
}

app.http('DeactivatePipeline', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/deactivate',
  handler,
});

