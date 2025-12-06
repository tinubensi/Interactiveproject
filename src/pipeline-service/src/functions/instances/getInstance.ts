/**
 * Get Instance API
 * GET /api/instances/:id
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getInstance, InstanceNotFoundError } from '../../repositories/instanceRepository';
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
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_READ);

    const instanceId = request.params.id;
    if (!instanceId) {
      return errorResponse(request, 'Instance ID is required', 400);
    }

    const instance = await getInstance(instanceId);

    return successResponse(request, { instance });
  } catch (error: any) {
    if (error instanceof InstanceNotFoundError) {
      return notFoundResponse(request, 'Instance');
    }
    context.error('Get instance error:', error);
    return errorResponse(request, error.message || 'Failed to get instance', 500);
  }
}

app.http('GetInstance', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/{id}',
  handler,
});

