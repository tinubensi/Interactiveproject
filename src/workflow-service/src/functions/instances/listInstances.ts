import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import { listInstances } from '../../lib/repositories/instanceRepository';
import { successResponse, handleError } from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { InstanceFilters, InstanceStatus } from '../../models/workflowTypes';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_READ);

    const filters: InstanceFilters = {
      organizationId:
        request.query.get('organizationId') || userContext.organizationId,
      workflowId: request.query.get('workflowId') || undefined,
      status: request.query.get('status') as InstanceStatus | undefined,
      correlationId: request.query.get('correlationId') || undefined,
      initiatedBy: request.query.get('initiatedBy') || undefined,
      startDateFrom: request.query.get('startDateFrom') || undefined,
      startDateTo: request.query.get('startDateTo') || undefined
    };

    context.log('Listing workflow instances', filters);

    const instances = await listInstances(filters);

    return successResponse({
      instances: instances.map((inst) => ({
        instanceId: inst.instanceId,
        workflowId: inst.workflowId,
        workflowName: inst.workflowName,
        workflowVersion: inst.workflowVersion,
        status: inst.status,
        triggerType: inst.triggerType,
        currentStepId: inst.currentStepId,
        correlationId: inst.correlationId,
        createdAt: inst.createdAt,
        startedAt: inst.startedAt,
        completedAt: inst.completedAt,
        initiatedBy: inst.initiatedBy,
        errorCount: inst.errorCount
      })),
      count: instances.length
    });
  } catch (error) {
    context.error('Error listing instances', error);
    return handleError(error);
  }
};

app.http('ListInstances', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances',
  handler
});

