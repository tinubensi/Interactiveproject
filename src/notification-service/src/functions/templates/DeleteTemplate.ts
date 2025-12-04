/**
 * DeleteTemplate Handler
 * DELETE /api/notifications/templates/{templateId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deleteTemplate } from '../../lib/templateRepository';

export async function DeleteTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('DeleteTemplate function processing request');

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

    // Delete template
    await deleteTemplate(templateId);

    return {
      status: 204,
      body: undefined,
    };
  } catch (error) {
    context.error('DeleteTemplate error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return {
        status: 404,
        jsonBody: { error: error.message },
      };
    }

    if (error instanceof Error && error.message.includes('system templates')) {
      return {
        status: 403,
        jsonBody: { error: error.message },
      };
    }

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('DeleteTemplate', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'notifications/templates/{templateId}',
  handler: DeleteTemplateHandler,
});

