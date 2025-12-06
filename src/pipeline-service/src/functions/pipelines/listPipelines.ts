/**
 * List Pipelines API
 * GET /api/pipelines
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listPipelines } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import type { LineOfBusiness, PipelineStatus } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.PIPELINES_READ);

    // Parse query parameters
    const lineOfBusiness = request.query.get('lineOfBusiness') as LineOfBusiness | null;
    const status = request.query.get('status') as PipelineStatus | null;
    const organizationId = request.query.get('organizationId');

    const pipelines = await listPipelines({
      lineOfBusiness: lineOfBusiness || undefined,
      status: status || undefined,
      organizationId: organizationId || undefined,
    });

    return successResponse(request, {
      pipelines,
      count: pipelines.length,
    });
  } catch (error: any) {
    context.error('List pipelines error:', error);
    return errorResponse(request, error.message || 'Failed to list pipelines', 500);
  }
}

app.http('ListPipelines', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipelines',
  handler,
});

