"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkflowAnalyticsHandler = void 0;
const functions_1 = require("@azure/functions");
const analyticsAggregator_1 = require("../../lib/analyticsAggregator");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
async function getWorkflowAnalyticsHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        const workflowId = request.params.workflowId;
        if (!workflowId) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Workflow ID is required'));
        }
        const periodParam = request.query.get('period') || 'week';
        if (!['day', 'week', 'month'].includes(periodParam)) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Invalid period. Must be day, week, or month'));
        }
        const period = periodParam;
        const analytics = await (0, analyticsAggregator_1.getWorkflowAnalytics)(workflowId, period);
        telemetry?.trackEvent('WorkflowAnalyticsRetrieved', {
            workflowId,
            period,
            totalExecutions: String(analytics.totalExecutions),
        });
        telemetry?.trackMetric('analytics.workflow.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)(analytics));
    }
    catch (error) {
        telemetry?.trackException(error, {
            operation: 'getWorkflowAnalytics',
            workflowId: request.params.workflowId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.getWorkflowAnalyticsHandler = getWorkflowAnalyticsHandler;
functions_1.app.http('getWorkflowAnalytics', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'analytics/workflows/{workflowId}',
    handler: getWorkflowAnalyticsHandler,
});
//# sourceMappingURL=getWorkflowAnalytics.js.map