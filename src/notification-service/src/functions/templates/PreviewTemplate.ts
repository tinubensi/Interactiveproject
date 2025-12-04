/**
 * PreviewTemplate Handler
 * POST /api/notifications/templates/{templateId}/preview
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findTemplateById } from '../../lib/templateRepository';
import { renderAllChannels, validateVariables } from '../../lib/templateRenderer';
import { PreviewTemplateRequest } from '../../models/NotificationTemplate';

export async function PreviewTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('PreviewTemplate function processing request');

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
    const body = (await request.json()) as PreviewTemplateRequest;

    if (!body.variables) {
      return {
        status: 400,
        jsonBody: { error: 'variables is required' },
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

    // Validate variables
    const validation = validateVariables(template, body.variables);
    if (!validation.valid) {
      return {
        status: 400,
        jsonBody: {
          error: 'Variable validation failed',
          errors: validation.errors,
          missingVariables: validation.missingVariables,
        },
      };
    }

    // Render template
    const rendered = renderAllChannels(template, body.variables);

    return {
      status: 200,
      jsonBody: {
        templateId: template.templateId,
        rendered,
      },
    };
  } catch (error) {
    context.error('PreviewTemplate error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('PreviewTemplate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'notifications/templates/{templateId}/preview',
  handler: PreviewTemplateHandler,
});

