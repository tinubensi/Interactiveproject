/**
 * List Instances API
 * GET /api/instances
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listInstances } from '../../repositories/instanceRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import type { InstanceStatus, LineOfBusiness } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_READ);

    // Parse query parameters
    const pipelineId = request.query.get('pipelineId');
    const leadId = request.query.get('leadId');
    const status = request.query.get('status') as InstanceStatus | null;
    const lineOfBusiness = request.query.get('lineOfBusiness') as LineOfBusiness | null;
    const organizationId = request.query.get('organizationId');

    const instances = await listInstances({
      pipelineId: pipelineId || undefined,
      leadId: leadId || undefined,
      status: status || undefined,
      lineOfBusiness: lineOfBusiness || undefined,
      organizationId: organizationId || undefined,
    });

    return successResponse(request, {
      instances,
      count: instances.length,
    });
  } catch (error: any) {
    context.error('List instances error:', error);
    return errorResponse(request, error.message || 'Failed to list instances', 500);
  }
}

app.http('ListInstances', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances',
  handler,
});

