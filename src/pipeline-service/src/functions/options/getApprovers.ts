/**
 * Get Approvers Options API
 * GET /api/options/approvers
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PREDEFINED_APPROVERS } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    return successResponse(request, {
      approvers: PREDEFINED_APPROVERS.map(approver => ({
        id: approver.id,
        name: approver.name,
        description: approver.description,
        icon: approver.icon,
        defaultTimeoutHours: approver.defaultTimeoutHours,
      })),
      count: PREDEFINED_APPROVERS.length,
    });
  } catch (error: any) {
    context.error('Get approvers error:', error);
    return errorResponse(request, error.message || 'Failed to get approvers', 500);
  }
}

app.http('GetApprovers', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'options/approvers',
  handler,
});

