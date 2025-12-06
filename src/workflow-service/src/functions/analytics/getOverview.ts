import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getAnalyticsOverview } from '../../lib/analyticsAggregator';
import { successResponse, handleError, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import type { AnalyticsPeriod } from '../../models/workflowTypes';

export async function getOverviewHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const organizationId = request.query.get('organizationId');

    if (!organizationId) {
      return withCors(request, badRequestResponse('Organization ID is required', undefined, request));
    }

    const periodParam = request.query.get('period') || 'week';
    if (!['day', 'week', 'month'].includes(periodParam)) {
      return withCors(request, badRequestResponse('Invalid period. Must be day, week, or month', undefined, request));
    }

    const period = periodParam as AnalyticsPeriod;

    const overview = await getAnalyticsOverview(organizationId, period);

    telemetry?.trackEvent('AnalyticsOverviewRetrieved', {
      organizationId,
      period,
      totalWorkflows: String(overview.totalWorkflows),
      totalExecutions: String(overview.totalExecutions),
    });

    telemetry?.trackMetric('analytics.overview.duration', Date.now() - startTime);

    return withCors(request, successResponse(overview, request));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'getAnalyticsOverview',
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('getOverview', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'analytics/overview',
  handler: getOverviewHandler,
});

