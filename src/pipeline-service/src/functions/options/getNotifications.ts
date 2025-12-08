/**
 * Get Notifications Options API
 * GET /api/options/notifications
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PREDEFINED_NOTIFICATIONS } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    return successResponse(request, {
      notifications: PREDEFINED_NOTIFICATIONS.map(notification => ({
        id: notification.id,
        name: notification.name,
        description: notification.description,
        icon: notification.icon,
        channel: notification.channel,
        recipientType: notification.recipientType,
      })),
      count: PREDEFINED_NOTIFICATIONS.length,
    });
  } catch (error: any) {
    context.error('Get notifications error:', error);
    return errorResponse(request, error.message || 'Failed to get notifications', 500);
  }
}

app.http('GetNotifications', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'options/notifications',
  handler,
});

