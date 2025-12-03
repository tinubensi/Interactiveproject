"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createFromTemplateHandler = void 0;
const functions_1 = require("@azure/functions");
const templateRepository_1 = require("../../lib/repositories/templateRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
const auth_1 = require("../../lib/utils/auth");
async function createFromTemplateHandler(request, context) {
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
        // Validate required fields
        if (!body.name?.trim()) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Workflow name is required'));
        }
        if (!body.organizationId?.trim()) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.badRequestResponse)('Organization ID is required'));
        }
        const workflow = await (0, templateRepository_1.createWorkflowFromTemplate)({
            templateId,
            name: body.name,
            description: body.description,
            organizationId: body.organizationId,
            configuration: body.configuration,
        }, user.userId);
        telemetry?.trackEvent('WorkflowCreatedFromTemplate', {
            templateId,
            workflowId: workflow.workflowId,
            organizationId: body.organizationId,
            createdBy: user.userId,
        });
        telemetry?.trackMetric('templates.createWorkflow.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.createdResponse)(workflow));
    }
    catch (error) {
        if (error instanceof templateRepository_1.TemplateNotFoundError) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.notFoundResponse)('Template'));
        }
        telemetry?.trackException(error, {
            operation: 'createFromTemplate',
            templateId: request.params.templateId,
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.createFromTemplateHandler = createFromTemplateHandler;
functions_1.app.http('createFromTemplate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'templates/{templateId}/create-workflow',
    handler: createFromTemplateHandler,
});
//# sourceMappingURL=createFromTemplate.js.map