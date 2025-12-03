"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCanvasHandler = void 0;
const functions_1 = require("@azure/functions");
const canvasRepository_1 = require("../../lib/repositories/canvasRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
async function getCanvasHandler(request, context) {
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
        const canvas = await (0, canvasRepository_1.getCanvas)(workflowId);
        telemetry?.trackEvent('CanvasRetrieved', {
            workflowId,
            found: String(canvas !== null),
        });
        telemetry?.trackMetric('canvas.get.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)(canvas));
    }
    catch (error) {
        telemetry?.trackException(error, {
            operation: 'getCanvas',
            workflowId: request.params.workflowId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.getCanvasHandler = getCanvasHandler;
functions_1.app.http('getCanvas', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/canvas',
    handler: getCanvasHandler,
});
//# sourceMappingURL=getCanvas.js.map