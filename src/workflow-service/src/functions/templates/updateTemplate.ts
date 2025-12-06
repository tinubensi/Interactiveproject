import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import {
  updateTemplate,
  TemplateNotFoundError,
} from '../../lib/repositories/templateRepository';
import { successResponse, handleError, notFoundResponse, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import { getUserFromRequest } from '../../lib/utils/auth';
import type { UpdateTemplateRequest } from '../../models/workflowTypes';

export async function updateTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const user = await getUserFromRequest(request);
    const templateId = request.params.templateId;

    if (!templateId) {
      return withCors(request, badRequestResponse('Template ID is required', undefined, request));
    }

    const body = (await request.json()) as UpdateTemplateRequest;

    const template = await updateTemplate(templateId, body, user.userId);

    telemetry?.trackEvent('TemplateUpdated', {
      templateId: template.templateId,
      category: template.category,
      version: String(template.version),
      updatedBy: user.userId,
    });

    telemetry?.trackMetric('templates.update.duration', Date.now() - startTime);

    return withCors(request, successResponse(template, request));
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      return withCors(request, notFoundResponse('Template', request));
    }

    telemetry?.trackException(error as Error, {
      operation: 'updateTemplate',
      templateId: request.params.templateId,
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('updateTemplate', {
  methods: ['PUT', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/{templateId}/update',
  handler: updateTemplateHandler,
});

