import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getWorkflowAnalytics } from '../../lib/analyticsAggregator';
import { successResponse, handleError, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import type { AnalyticsPeriod } from '../../models/workflowTypes';

export async function getWorkflowAnalyticsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const workflowId = request.params.workflowId;

    if (!workflowId) {
      return withCors(request, badRequestResponse('Workflow ID is required', undefined, request));
    }

    const periodParam = request.query.get('period') || 'week';
    if (!['day', 'week', 'month'].includes(periodParam)) {
      return withCors(request, badRequestResponse('Invalid period. Must be day, week, or month', undefined, request));
    }

    const period = periodParam as AnalyticsPeriod;

    const analytics = await getWorkflowAnalytics(workflowId, period);

    telemetry?.trackEvent('WorkflowAnalyticsRetrieved', {
      workflowId,
      period,
      totalExecutions: String(analytics.totalExecutions),
    });

    telemetry?.trackMetric('analytics.workflow.duration', Date.now() - startTime);

    return withCors(request, successResponse(analytics, request));
  } catch (error) {
    telemetry?.trackException(error as Error, {
      operation: 'getWorkflowAnalytics',
      workflowId: request.params.workflowId,
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('getWorkflowAnalytics', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'analytics/workflows/{workflowId}',
  handler: getWorkflowAnalyticsHandler,
});

