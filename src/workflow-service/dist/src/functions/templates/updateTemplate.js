"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateTemplateHandler = void 0;
const functions_1 = require("@azure/functions");
const templateRepository_1 = require("../../lib/repositories/templateRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
const auth_1 = require("../../lib/utils/auth");
async function updateTemplateHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        const user = await (0, auth_1.getUserFromRequest)(request);
        const templateId = request.params.templateId;
        if (!templateId) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Template ID is required'));
        }
        const body = (await request.json());
        const template = await (0, templateRepository_1.updateTemplate)(templateId, body, user.userId);
        telemetry?.trackEvent('TemplateUpdated', {
            templateId: template.templateId,
            category: template.category,
            version: String(template.version),
            updatedBy: user.userId,
        });
        telemetry?.trackMetric('templates.update.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)(template));
    }
    catch (error) {
        if (error instanceof templateRepository_1.TemplateNotFoundError) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.notFoundResponse)('Template'));
        }
        telemetry?.trackException(error, {
            operation: 'updateTemplate',
            templateId: request.params.templateId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.updateTemplateHandler = updateTemplateHandler;
functions_1.app.http('updateTemplate', {
    methods: ['PUT', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'templates/{templateId}/update',
    handler: updateTemplateHandler,
});
//# sourceMappingURL=updateTemplate.js.map