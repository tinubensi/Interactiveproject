/**
 * CreateTemplate Handler
 * POST /api/notifications/templates
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createTemplate, templateExists } from '../../lib/templateRepository';
import { CreateTemplateRequest } from '../../models/NotificationTemplate';

export async function CreateTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateTemplate function processing request');

  try {
    // Get user ID from auth header
    const userId = request.headers.get('x-user-id');
    if (!userId) {
      return {
        status: 401,
        jsonBody: { error: 'User ID required' },
      };
    }

    // Parse body
    const body = (await request.json()) as CreateTemplateRequest;

    // Validate required fields
    if (!body.templateId) {
      return {
        status: 400,
        jsonBody: { error: 'templateId is required' },
      };
    }

    if (!body.name) {
      return {
        status: 400,
        jsonBody: { error: 'name is required' },
      };
    }

    if (!body.content?.inApp) {
      return {
        status: 400,
        jsonBody: { error: 'content.inApp is required' },
      };
    }

    if (!body.defaultChannels || body.defaultChannels.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'defaultChannels is required' },
      };
    }

    // Check if template already exists
    if (await templateExists(body.templateId)) {
      return {
        status: 409,
        jsonBody: { error: `Template "${body.templateId}" already exists` },
      };
    }

    // Create template
    const template = await createTemplate(body, userId);

    return {
      status: 201,
      jsonBody: {
        id: template.id,
        templateId: template.templateId,
        name: template.name,
        isActive: template.isActive,
        createdAt: template.createdAt,
      },
    };
  } catch (error) {
    context.error('CreateTemplate error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('CreateTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/templates',
  handler: CreateTemplateHandler,
});

