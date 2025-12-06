/**
 * Get Instance By Lead API
 * GET /api/instances/lead/:leadId
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getInstanceByLeadId, getAllInstancesForLead } from '../../repositories/instanceRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_READ);

    const leadId = request.params.leadId;
    if (!leadId) {
      return errorResponse(request, 'Lead ID is required', 400);
    }

    const includeAll = request.query.get('includeAll') === 'true';

    if (includeAll) {
      const instances = await getAllInstancesForLead(leadId);
      return successResponse(request, {
        leadId,
        instances,
        count: instances.length,
      });
    }

    const instance = await getInstanceByLeadId(leadId);

    return successResponse(request, {
      leadId,
      hasActivePipeline: !!instance,
      instance,
    });
  } catch (error: any) {
    context.error('Get instance by lead error:', error);
    return errorResponse(request, error.message || 'Failed to get instance', 500);
  }
}

app.http('GetInstanceByLead', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/lead/{leadId}',
  handler,
});

