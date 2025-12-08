/**
 * UpdateTemplate Handler
 * PUT /api/notifications/templates/{templateId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { updateTemplate } from '../../lib/templateRepository';
import { UpdateTemplateRequest } from '../../models/NotificationTemplate';

export async function UpdateTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('UpdateTemplate function processing request');

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

    // Parse body
    const body = (await request.json()) as UpdateTemplateRequest;

    // Update template
    const template = await updateTemplate(templateId, body, userId);

    return {
      status: 200,
      jsonBody: {
        id: template.id,
        templateId: template.templateId,
        name: template.name,
        isActive: template.isActive,
        updatedAt: template.updatedAt,
      },
    };
  } catch (error) {
    context.error('UpdateTemplate error:', error);

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

app.http('UpdateTemplate', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'notifications/templates/{templateId}',
  handler: UpdateTemplateHandler,
});

