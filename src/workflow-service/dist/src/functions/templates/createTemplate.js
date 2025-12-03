"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTemplateHandler = void 0;
const functions_1 = require("@azure/functions");
const templateRepository_1 = require("../../lib/repositories/templateRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
const auth_1 = require("../../lib/utils/auth");
async function createTemplateHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        const user = await (0, auth_1.getUserFromRequest)(request);
        const body = (await request.json());
        // Validate required fields
        if (!body.name?.trim()) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Template name is required'));
        }
        if (!body.category?.trim()) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Template category is required'));
        }
        if (!body.baseWorkflow) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Base workflow configuration is required'));
        }
        const template = await (0, templateRepository_1.createTemplate)(body, user.userId);
        telemetry?.trackEvent('TemplateCreated', {
            templateId: template.templateId,
            category: template.category,
            createdBy: user.userId,
        });
        telemetry?.trackMetric('templates.create.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.createdResponse)(template));
    }
    catch (error) {
        telemetry?.trackException(error, {
            operation: 'createTemplate',
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.createTemplateHandler = createTemplateHandler;
functions_1.app.http('createTemplate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'templates',
    handler: createTemplateHandler,
});
//# sourceMappingURL=createTemplate.js.map