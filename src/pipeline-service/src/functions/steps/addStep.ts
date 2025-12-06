/**
 * Add Step API
 * POST /api/pipelines/:id/steps
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { addStep, PipelineNotFoundError } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse, badRequestResponse } from '../../utils/corsHelper';
import type { AddStepRequest } from '../../models/pipeline';

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

    const body = await request.json() as AddStepRequest;

    if (!body.step) {
      return badRequestResponse(request, 'step is required');
    }

    if (!body.step.type) {
      return badRequestResponse(request, 'step.type is required');
    }

    context.log(`Adding step to pipeline ${pipelineId}`);

    const pipeline = await addStep(pipelineId, body.step, body.afterStepId, userContext.userId);

    return successResponse(request, { pipeline }, 201);
  } catch (error: any) {
    if (error instanceof PipelineNotFoundError) {
      return notFoundResponse(request, 'Pipeline');
    }
    context.error('Add step error:', error);
    return errorResponse(request, error.message || 'Failed to add step', 500);
  }
}

app.http('AddStep', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/{id}/steps',
  handler,
});

