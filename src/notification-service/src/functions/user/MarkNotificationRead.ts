/**
 * MarkNotificationRead Handler
 * PATCH /api/notifications/{notificationId}/read
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { markNotificationRead } from '../../lib/notificationRepository';
import { publishNotificationEvent, NOTIFICATION_EVENTS } from '../../lib/eventPublisher';

export async function MarkNotificationReadHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('MarkNotificationRead function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Get notification ID from route
    const notificationId = request.params.notificationId;
    if (!notificationId) {
      return {
        status: 400,
        jsonBody: { error: 'Notification ID is required' },
      };
    }

    // Mark as read
    const notification = await markNotificationRead(notificationId, userId);

    if (!notification) {
      return {
        status: 404,
        jsonBody: { error: 'Notification not found' },
      };
    }

    // Publish event
    await publishNotificationEvent(
      NOTIFICATION_EVENTS.NOTIFICATION_READ,
      notificationId,
      userId,
      { readAt: notification.readAt }
    );

    return {
      status: 200,
      jsonBody: {
        id: notification.id,
        isRead: notification.isRead,
        readAt: notification.readAt,
      },
    };
  } catch (error) {
    context.error('MarkNotificationRead error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('MarkNotificationRead', {
  methods: ['PATCH'],
  authLevel: 'anonymous',
  route: 'notifications/{notificationId}/read',
  handler: MarkNotificationReadHandler,
});

