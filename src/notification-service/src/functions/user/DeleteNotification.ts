/**
 * DeleteNotification Handler
 * DELETE /api/notifications/{notificationId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deleteNotification } from '../../lib/notificationRepository';

export async function DeleteNotificationHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('DeleteNotification function processing request');

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

    // Delete notification
    const deleted = await deleteNotification(notificationId, userId);

    if (!deleted) {
      return {
        status: 404,
        jsonBody: { error: 'Notification not found' },
      };
    }

    return {
      status: 204,
      body: undefined,
    };
  } catch (error) {
    context.error('DeleteNotification error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('DeleteNotification', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'notifications/{notificationId}',
  handler: DeleteNotificationHandler,
});

