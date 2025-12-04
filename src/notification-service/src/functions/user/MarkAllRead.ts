/**
 * MarkAllRead Handler
 * POST /api/notifications/me/read-all
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { markAllNotificationsRead } from '../../lib/notificationRepository';

export async function MarkAllReadHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('MarkAllRead function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Mark all as read
    const count = await markAllNotificationsRead(userId);

    return {
      status: 200,
      jsonBody: {
        markedRead: count,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    context.error('MarkAllRead error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('MarkAllRead', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/me/read-all',
  handler: MarkAllReadHandler,
});

