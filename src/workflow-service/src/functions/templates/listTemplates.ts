import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { listTemplates } from '../../lib/repositories/templateRepository';
import { successResponse, handleError } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import type { TemplateFilters } from '../../models/workflowTypes';

export async function listTemplatesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    // Parse filters from query params
    const filters: TemplateFilters = {};

    const category = request.query.get('category');
    if (category) {
      filters.category = category;
    }

    const tags = request.query.get('tags');
    if (tags) {
      filters.tags = tags.split(',').map((t) => t.trim());
    }

    const isPublic = request.query.get('isPublic');
    if (isPublic !== null) {
      filters.isPublic = isPublic === 'true';
    }

    const organizationId = request.query.get('organizationId');
    if (organizationId) {
      filters.organizationId = organizationId;
    }

    const search = request.query.get('search');
    if (search) {
      filters.search = search;
    }

    const templates = await listTemplates(filters);

    telemetry?.trackEvent('TemplatesListed', {
      count: String(templates.length),
      category: category || 'all',
    });

    telemetry?.trackMetric('templates.list.duration', Date.now() - startTime);

    return withCors(
      successResponse({
        templates,
        count: templates.length,
      })
    );
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'listTemplates',
    });
    return withCors(handleError(error));
  }
}

app.http('listTemplates', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/list',
  handler: listTemplatesHandler,
});

