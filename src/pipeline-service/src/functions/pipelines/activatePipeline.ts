/**
 * Activate Pipeline API
 * POST /api/pipelines/:id/activate
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { activatePipeline, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse } from '../../utils/corsHelper';
import { publishPipelineActivated } from '../../services/eventGridService';

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

    context.log(`Activating pipeline ${pipelineId}`);

    const pipeline = await activatePipeline(pipelineId, userContext.userId);

    // Publish activation event
    await publishPipelineActivated({
      pipelineId: pipeline.pipelineId,
      lineOfBusiness: pipeline.lineOfBusiness,
      activatedBy: userContext.userId,
    });

    return successResponse(request, { pipeline });
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Activate pipeline error:', error);
    return errorResponse(request, error.message || 'Failed to activate pipeline', 500);
  }
}

app.http('ActivatePipeline', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/activate',
  handler,
});

