/**
 * GetTemplate Handler
 * GET /api/notifications/templates/{templateId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findTemplateById } from '../../lib/templateRepository';

export async function GetTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetTemplate function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Get template ID from route
    const templateId = request.params.templateId;
    if (!templateId) {
      return {
        status: 400,
        jsonBody: { error: 'Template ID is required' },
      };
    }

    // Get template
    const template = await findTemplateById(templateId);

    if (!template) {
      return {
        status: 404,
        jsonBody: { error: `Template "${templateId}" not found` },
      };
    }

    return {
      status: 200,
      jsonBody: template,
    };
  } catch (error) {
    context.error('GetTemplate error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetTemplate', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/templates/{templateId}',
  handler: GetTemplateHandler,
});

