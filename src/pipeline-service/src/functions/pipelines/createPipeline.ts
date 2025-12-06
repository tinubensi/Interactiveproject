/**
 * Create Pipeline API
 * POST /api/pipelines
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createPipeline } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, badRequestResponse } from '../../utils/corsHelper';
import type { CreatePipelineRequest } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.PIPELINES_CREATE);

    const body = await request.json() as CreatePipelineRequest;

    if (!body.name) {
      return badRequestResponse(request, 'name is required');
    }

    if (!body.lineOfBusiness) {
      return badRequestResponse(request, 'lineOfBusiness is required');
    }

    context.log(`Creating pipeline: ${body.name} for ${body.lineOfBusiness}`);

    const pipeline = await createPipeline(body, userContext.userId);

    context.log(`Created pipeline ${pipeline.pipelineId}`);

    return successResponse(request, { pipeline }, 201);
  } catch (error: any) {
    context.error('Create pipeline error:', error);
    return errorResponse(request, error.message || 'Failed to create pipeline', 500);
  }
}

app.http('CreatePipeline', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines/create',
  handler,
});

