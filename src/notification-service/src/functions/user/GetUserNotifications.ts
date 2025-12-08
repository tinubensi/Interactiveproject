/**
 * GetUserNotifications Handler
 * GET /api/notifications/me
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserNotifications, getUnreadCount } from '../../lib/notificationRepository';
import { NotificationCategory, UserNotificationsResponse } from '../../models/Notification';

export async function GetUserNotificationsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetUserNotifications function processing request');

  try {
    // Get user ID from auth header (simplified for MVP)
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Parse query parameters
    const categoryParam = request.query.get('category');
    const isReadParam = request.query.get('isRead');
    const limitParam = request.query.get('limit');
    const continuationToken = request.query.get('continuationToken');

    // Build query
    const query = {
      category: categoryParam as NotificationCategory | undefined,
      isRead: isReadParam !== null ? isReadParam === 'true' : undefined,
      limit: limitParam ? parseInt(limitParam, 10) : 50,
      continuationToken: continuationToken || undefined,
    };

    // Get notifications
    const { notifications, continuationToken: nextToken } = await getUserNotifications(
      userId,
      query
    );

    // Get unread count
    const unreadCountResult = await getUnreadCount(userId);

    const response: UserNotificationsResponse = {
      notifications,
      unreadCount: unreadCountResult.total,
      continuationToken: nextToken,
    };

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error('GetUserNotifications error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetUserNotifications', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/me',
  handler: GetUserNotificationsHandler,
});

