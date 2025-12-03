"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions_1 = require("@azure/functions");
const workflowRepository_1 = require("../../lib/repositories/workflowRepository");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const auth_1 = require("../../lib/utils/auth");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const handler = async (request, context) => {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        const userContext = (0, auth_1.ensureAuthorized)(request);
        const filters = {
            organizationId: request.query.get('organizationId') || userContext.organizationId,
            status: request.query.get('status'),
            category: request.query.get('category') || undefined,
            search: request.query.get('search') || undefined,
            includeDeleted: request.query.get('includeDeleted') === 'true'
        };
        const tags = request.query.get('tags');
        if (tags) {
            filters.tags = tags.split(',');
        }
        context.log('Listing workflows', filters);
        const workflows = await (0, workflowRepository_1.listWorkflows)(filters);
        return (0, httpResponses_1.successResponse)({
            workflows,
            count: workflows.length
        });
    }
    catch (error) {
        context.error('Error listing workflows', error);
        return (0, httpResponses_1.handleError)(error);
    }
};
functions_1.app.http('ListWorkflows', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'workflows/list',
    handler
});
//# sourceMappingURL=listWorkflows.js.map