"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTemplatesHandler = void 0;
const functions_1 = require("@azure/functions");
const templateRepository_1 = require("../../lib/repositories/templateRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const telemetry_1 = require("../../lib/telemetry");
async function listTemplatesHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    const telemetry = (0, telemetry_1.getTelemetry)();
    const startTime = Date.now();
    try {
        // Parse filters from query params
        const filters = {};
        const category = request.query.get('category');
        if (category) {
            filters.category = category;
        }
        const tags = request.query.get('tags');
        if (tags) {
            filters.tags = tags.split(',').map((t) => t.trim());
        }
        const isPublic = request.query.get('isPublic');
        if (isPublic !== null) {
            filters.isPublic = isPublic === 'true';
        }
        const organizationId = request.query.get('organizationId');
        if (organizationId) {
            filters.organizationId = organizationId;
        }
        const search = request.query.get('search');
        if (search) {
            filters.search = search;
        }
        const templates = await (0, templateRepository_1.listTemplates)(filters);
        telemetry?.trackEvent('TemplatesListed', {
            count: String(templates.length),
            category: category || 'all',
        });
        telemetry?.trackMetric('templates.list.duration', Date.now() - startTime);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)({
            templates,
            count: templates.length,
        }));
    }
    catch (error) {
        telemetry?.trackException(error, {
            operation: 'listTemplates',
        });
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.listTemplatesHandler = listTemplatesHandler;
functions_1.app.http('listTemplates', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'templates/list',
    handler: listTemplatesHandler,
});
//# sourceMappingURL=listTemplates.js.map