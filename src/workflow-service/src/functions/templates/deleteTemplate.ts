import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import {
  deleteTemplate,
  TemplateNotFoundError,
} from '../../lib/repositories/templateRepository';
import { successResponse, handleError, notFoundResponse, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';

export async function deleteTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const templateId = request.params.templateId;

    if (!templateId) {
      return withCors(request, badRequestResponse('Template ID is required', undefined, request));
    }

    await deleteTemplate(templateId);

    telemetry?.trackEvent('TemplateDeleted', {
      templateId,
    });

    telemetry?.trackMetric('templates.delete.duration', Date.now() - startTime);

    return withCors(request, successResponse({ message: 'Template deleted successfully' }, request));
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      return withCors(request, notFoundResponse('Template', request));
    }

    telemetry?.trackException(error as Error, {
      operation: 'deleteTemplate',
      templateId: request.params.templateId,
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('deleteTemplate', {
  methods: ['DELETE', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/{templateId}',
  handler: deleteTemplateHandler,
});

