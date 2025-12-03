"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplateHandler = void 0;
const functions_1 = require("@azure/functions");
const templateRepository_1 = require("../../lib/repositories/templateRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
async function getTemplateHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        const templateId = request.params.templateId;
        if (!templateId) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Template ID is required'));
        }
        const template = await (0, templateRepository_1.getTemplate)(templateId);
        telemetry?.trackEvent('TemplateRetrieved', {
            templateId,
            category: template.category,
        });
        telemetry?.trackMetric('templates.get.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)(template));
    }
    catch (error) {
        if (error instanceof templateRepository_1.TemplateNotFoundError) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.notFoundResponse)('Template'));
        }
        telemetry?.trackException(error, {
            operation: 'getTemplate',
            templateId: request.params.templateId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.getTemplateHandler = getTemplateHandler;
functions_1.app.http('getTemplate', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'templates/{templateId}/details',
    handler: getTemplateHandler,
});
//# sourceMappingURL=getTemplate.js.map