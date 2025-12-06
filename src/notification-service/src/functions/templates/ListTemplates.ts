/**
 * ListTemplates Handler
 * GET /api/notifications/templates
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listTemplates } from '../../lib/templateRepository';

export async function ListTemplatesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('ListTemplates function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Check if include inactive
    const includeInactive = request.query.get('includeInactive') === 'true';

    // Get templates
    const templates = await listTemplates(includeInactive);

    return {
      status: 200,
      jsonBody: {
        templates,
        total: templates.length,
      },
    };
  } catch (error) {
    context.error('ListTemplates error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('ListTemplates', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/templates',
  handler: ListTemplatesHandler,
});

