import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { createTemplate } from '../../lib/repositories/templateRepository';
import { createdResponse, handleError, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import { getUserFromRequest } from '../../lib/utils/auth';
import type { CreateTemplateRequest } from '../../models/workflowTypes';

export async function createTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const user = await getUserFromRequest(request);
    const body = (await request.json()) as CreateTemplateRequest;

    // Validate required fields
    if (!body.name?.trim()) {
      return withCors(request, badRequestResponse('Template name is required', undefined, request));
    }

    if (!body.category?.trim()) {
      return withCors(request, badRequestResponse('Template category is required', undefined, request));
    }

    if (!body.baseWorkflow) {
      return withCors(request, badRequestResponse('Base workflow configuration is required', undefined, request));
    }

    const template = await createTemplate(body, user.userId);

    telemetry?.trackEvent('TemplateCreated', {
      templateId: template.templateId,
      category: template.category,
      createdBy: user.userId,
    });

    telemetry?.trackMetric('templates.create.duration', Date.now() - startTime);

    return withCors(request, createdResponse(template, request));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'createTemplate',
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('createTemplate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates',
  handler: createTemplateHandler,
});

