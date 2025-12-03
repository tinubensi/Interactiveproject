import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import {
  getTemplate,
  TemplateNotFoundError,
} from '../../lib/repositories/templateRepository';
import { successResponse, handleError, notFoundResponse, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';

export async function getTemplateHandler(
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
      return withCors(badRequestResponse('Template ID is required'));
    }

    const template = await getTemplate(templateId);

    telemetry?.trackEvent('TemplateRetrieved', {
      templateId,
      category: template.category,
    });

    telemetry?.trackMetric('templates.get.duration', Date.now() - startTime);

    return withCors(successResponse(template));
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      return withCors(notFoundResponse('Template'));
    }

    telemetry?.trackException(error as Error, {
      operation: 'getTemplate',
      templateId: request.params.templateId,
    });
    return withCors(handleError(error));
  }
}

app.http('getTemplate', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/{templateId}/details',
  handler: getTemplateHandler,
});

