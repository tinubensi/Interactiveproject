/**
 * List Policy Requests Function
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { PolicyRequestListRequest } from '../../models/policy';
import { ensureAuthorized, requirePermission, POLICY_PERMISSIONS } from '../../lib/auth';

export async function listPolicyRequests(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, POLICY_PERMISSIONS.POLICIES_READ);
    const body: PolicyRequestListRequest = await request.json() as PolicyRequestListRequest;

    const listRequest: PolicyRequestListRequest = {
      quotationId: body.quotationId,
      leadId: body.leadId,
      customerId: body.customerId,
      page: body.page || 1,
      limit: Math.min(body.limit || 20, 100),
      sortBy: body.sortBy || 'createdAt',
      sortOrder: body.sortOrder || 'desc',
      filters: body.filters || {}
    };

    const result = await cosmosService.listPolicyRequests(listRequest);

    context.log(`Listed ${result.data.length} policy requests`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        ...result
      }
    };
  } catch (error: any) {
    context.error('List policy requests error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to list policy requests',
        details: error.message
      }
    };
  }
}

app.http('listPolicyRequests', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'policy-requests/list',
  handler: listPolicyRequests
});


