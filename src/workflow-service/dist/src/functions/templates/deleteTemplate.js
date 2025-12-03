"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTemplateHandler = void 0;
const functions_1 = require("@azure/functions");
const templateRepository_1 = require("../../lib/repositories/templateRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
async function deleteTemplateHandler(request, context) {
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
        await (0, templateRepository_1.deleteTemplate)(templateId);
        telemetry?.trackEvent('TemplateDeleted', {
            templateId,
        });
        telemetry?.trackMetric('templates.delete.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)({ message: 'Template deleted successfully' }));
    }
    catch (error) {
        if (error instanceof templateRepository_1.TemplateNotFoundError) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.notFoundResponse)('Template'));
        }
        telemetry?.trackException(error, {
            operation: 'deleteTemplate',
            templateId: request.params.templateId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.deleteTemplateHandler = deleteTemplateHandler;
functions_1.app.http('deleteTemplate', {
    methods: ['DELETE', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'templates/{templateId}',
    handler: deleteTemplateHandler,
});
//# sourceMappingURL=deleteTemplate.js.map