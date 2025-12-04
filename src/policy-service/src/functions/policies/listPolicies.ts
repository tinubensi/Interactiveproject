/**
 * List Policies Function
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { PolicyListRequest } from '../../models/policy';

export async function listPolicies(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  try {
    const body: PolicyListRequest = await request.json() as PolicyListRequest;

    const listRequest: PolicyListRequest = {
      customerId: body.customerId,
      leadId: body.leadId,
      page: body.page || 1,
      limit: Math.min(body.limit || 20, 100),
      sortBy: body.sortBy || 'issueDate',
      sortOrder: body.sortOrder || 'desc',
      filters: body.filters || {}
    };

    const result = await cosmosService.listPolicies(listRequest);

    context.log(`Listed ${result.data.length} policies`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        ...result
      }
    };
  } catch (error: any) {
    context.error('List policies error:', error);
    return {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to list policies',
        details: error.message
      }
    };
  }
}

app.http('listPolicies', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'policies/list',
  handler: listPolicies
});


