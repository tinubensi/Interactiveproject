"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCanvasHandler = void 0;
const functions_1 = require("@azure/functions");
const canvasRepository_1 = require("../../lib/repositories/canvasRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
const auth_1 = require("../../lib/utils/auth");
async function saveCanvasHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        const user = await (0, auth_1.getUserFromRequest)(request);
        const workflowId = request.params.workflowId;
        if (!workflowId) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Workflow ID is required'));
        }
        const body = (await request.json());
        // Validate request body
        if (!body.nodePositions || typeof body.nodePositions !== 'object') {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('nodePositions is required'));
        }
        if (!body.viewport) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('viewport is required'));
        }
        const canvas = await (0, canvasRepository_1.saveCanvas)(workflowId, body, user.userId);
        telemetry?.trackEvent('CanvasSaved', {
            workflowId,
            version: String(canvas.version),
            nodeCount: String(Object.keys(body.nodePositions).length),
            savedBy: user.userId,
        });
        telemetry?.trackMetric('canvas.save.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)(canvas));
    }
    catch (error) {
        telemetry?.trackException(error, {
            operation: 'saveCanvas',
            workflowId: request.params.workflowId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.saveCanvasHandler = saveCanvasHandler;
functions_1.app.http('saveCanvas', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/{workflowId}/canvas/save',
    handler: saveCanvasHandler,
});
//# sourceMappingURL=saveCanvas.js.map