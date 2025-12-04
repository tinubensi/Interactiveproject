/**
 * GetUnreadCount Handler
 * GET /api/notifications/me/unread-count
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUnreadCount } from '../../lib/notificationRepository';

export async function GetUnreadCountHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetUnreadCount function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Get unread count
    const result = await getUnreadCount(userId);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('GetUnreadCount error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetUnreadCount', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/me/unread-count',
  handler: GetUnreadCountHandler,
});

