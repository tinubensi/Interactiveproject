/**
 * Get Wait Events Options API
 * GET /api/options/wait-events
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PREDEFINED_WAIT_EVENTS } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    return successResponse(request, {
      waitEvents: PREDEFINED_WAIT_EVENTS.map(waitEvent => ({
        id: waitEvent.id,
        name: waitEvent.name,
        description: waitEvent.description,
        icon: waitEvent.icon,
        eventType: waitEvent.eventType,
        defaultTimeoutHours: waitEvent.defaultTimeoutHours,
      })),
      count: PREDEFINED_WAIT_EVENTS.length,
    });
  } catch (error: any) {
    context.error('Get wait events error:', error);
    return errorResponse(request, error.message || 'Failed to get wait events', 500);
  }
}

app.http('GetWaitEvents', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'options/wait-events',
  handler,
});

