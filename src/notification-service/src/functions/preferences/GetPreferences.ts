/**
 * GetPreferences Handler
 * GET /api/notifications/preferences
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getOrCreatePreferences } from '../../lib/preferencesRepository';

export async function GetPreferencesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetPreferences function processing request');

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

    // Get or create preferences
    const preferences = await getOrCreatePreferences(userId, userEmail);

    return {
      status: 200,
      jsonBody: preferences,
    };
  } catch (error) {
    context.error('GetPreferences error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetPreferences', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/preferences',
  handler: GetPreferencesHandler,
});

