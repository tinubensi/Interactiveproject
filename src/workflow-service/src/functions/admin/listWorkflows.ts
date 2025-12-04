import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { listWorkflows } from '../../lib/repositories/workflowRepository';
import { successResponse, handleError } from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { WorkflowFilters, WorkflowStatus } from '../../models/workflowTypes';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_READ);

    const filters: WorkflowFilters = {
      organizationId:
        request.query.get('organizationId') || userContext.organizationId,
      status: request.query.get('status') as WorkflowStatus | undefined,
      category: request.query.get('category') || undefined,
      search: request.query.get('search') || undefined,
      includeDeleted: request.query.get('includeDeleted') === 'true'
    };

    const tags = request.query.get('tags');
    if (tags) {
      filters.tags = tags.split(',');
    }

    context.log('Listing workflows', filters);

    const workflows = await listWorkflows(filters);

    return successResponse({
      workflows,
      count: workflows.length
    });
  } catch (error) {
    context.error('Error listing workflows', error);
    return handleError(error);
  }
};

app.http('ListWorkflows', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/list',
  handler
});

