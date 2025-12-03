"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOverviewHandler = void 0;
const functions_1 = require("@azure/functions");
const analyticsAggregator_1 = require("../../lib/analyticsAggregator");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
async function getOverviewHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        const organizationId = request.query.get('organizationId');
        if (!organizationId) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Organization ID is required'));
        }
        const periodParam = request.query.get('period') || 'week';
        if (!['day', 'week', 'month'].includes(periodParam)) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Invalid period. Must be day, week, or month'));
        }
        const period = periodParam;
        const overview = await (0, analyticsAggregator_1.getAnalyticsOverview)(organizationId, period);
        telemetry?.trackEvent('AnalyticsOverviewRetrieved', {
            organizationId,
            period,
            totalWorkflows: String(overview.totalWorkflows),
            totalExecutions: String(overview.totalExecutions),
        });
        telemetry?.trackMetric('analytics.overview.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)(overview));
    }
    catch (error) {
        telemetry?.trackException(error, {
            operation: 'getAnalyticsOverview',
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.getOverviewHandler = getOverviewHandler;
functions_1.app.http('getOverview', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'analytics/overview',
    handler: getOverviewHandler,
});
//# sourceMappingURL=getOverview.js.map