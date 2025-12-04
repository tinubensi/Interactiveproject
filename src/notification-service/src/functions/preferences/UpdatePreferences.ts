/**
 * UpdatePreferences Handler
 * PUT /api/notifications/preferences
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { updatePreferences, getOrCreatePreferences } from '../../lib/preferencesRepository';
import { UpdatePreferencesRequest } from '../../models/NotificationPreferences';

export async function UpdatePreferencesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('UpdatePreferences function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    const userEmail = request.headers.get('x-user-email') || `${userId}@nectaria.com`;

    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Parse body
    const body = (await request.json()) as UpdatePreferencesRequest;

    // Ensure preferences exist first
    await getOrCreatePreferences(userId, userEmail);

    // Update preferences
    await updatePreferences(userId, body);

    return {
      status: 200,
      jsonBody: {
        userId,
        updated: true,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    context.error('UpdatePreferences error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return {
        status: 404,
        jsonBody: { error: error.message },
      };
    }

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('UpdatePreferences', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'notifications/preferences',
  handler: UpdatePreferencesHandler,
});

