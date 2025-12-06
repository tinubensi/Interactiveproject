import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext
} from '@azure/functions';
import {
  getWorkflow,
  WorkflowNotFoundError
} from '../../lib/repositories/workflowRepository';
import {
  createInstance,
  CreateInstanceParams
} from '../../lib/repositories/instanceRepository';
import {
  createdResponse,
  handleError,
  badRequestResponse,
  notFoundResponse
} from '../../lib/utils/httpResponses';
import { ensureAuthorized, requirePermission, WORKFLOW_PERMISSIONS } from '../../lib/utils/auth';
import { handlePreflight } from '../../lib/utils/corsHelper';
import { StartWorkflowRequest, HttpTriggerConfig } from '../../models/workflowTypes';

const handler = async (
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> => {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, WORKFLOW_PERMISSIONS.WORKFLOWS_EXECUTE);

    const workflowId = request.params.workflowId;
    if (!workflowId) {
      return badRequestResponse('Workflow ID is required', undefined, request);
    }

    context.log('Triggering workflow', { workflowId });

    // Get the active workflow
    const workflow = await getWorkflow(workflowId);

    if (workflow.status !== 'active') {
      return badRequestResponse(
        `Workflow ${workflowId} is not active (status: ${workflow.status})`,
        undefined,
        request
      );
    }

    // Find HTTP trigger
    const httpTrigger = workflow.triggers.find((t) => t.type === 'http');
    if (!httpTrigger) {
      return badRequestResponse(
        `Workflow ${workflowId} does not have an HTTP trigger configured`,
        undefined,
        request
      );
    }

    const triggerConfig = httpTrigger.config as HttpTriggerConfig;

    // Validate HTTP method if specified
    if (
      triggerConfig.method &&
      request.method !== triggerConfig.method &&
      request.method !== 'OPTIONS'
    ) {
      return badRequestResponse(
        `Invalid HTTP method. Expected ${triggerConfig.method}`,
        undefined,
        request
      );
    }

    // Parse request body
    let payload: StartWorkflowRequest = {};
    try {
      payload = (await request.json()) as StartWorkflowRequest;
    } catch {
      // Empty body is acceptable
    }

    // TODO: Validate payload against triggerConfig.validatePayload schema

    // Check if parallel executions are allowed
    if (workflow.settings?.allowParallelExecutions === false) {
      // TODO: Check for existing running instances
    }

    // Create the workflow instance
    const instanceParams: CreateInstanceParams = {
      workflowId: workflow.workflowId,
      workflowVersion: workflow.version,
      workflowName: workflow.name,
      organizationId: workflow.organizationId,
      triggerId: httpTrigger.id,
      triggerType: 'http',
      triggerData: {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers),
        body: payload
      },
      variables: {
        ...getDefaultVariables(workflow.variables),
        ...payload.variables,
        // Include trigger input in variables
        input: payload
      },
      correlationId: payload.correlationId,
      initiatedBy: payload.initiatedBy || userContext.userId
    };

    const instance = await createInstance(instanceParams);

    context.log(
      `Created workflow instance ${instance.instanceId} for workflow ${workflowId}`
    );

    // TODO: Start the Durable Functions orchestrator

    return createdResponse({
      instanceId: instance.instanceId,
      workflowId: instance.workflowId,
      workflowName: instance.workflowName,
      status: instance.status,
      createdAt: instance.createdAt,
      message: 'Workflow instance created successfully'
    }, request);
  } catch (error) {
    if (error instanceof WorkflowNotFoundError) {
      return notFoundResponse('Workflow', request);
    }
    context.error('Error triggering workflow', error);
    return handleError(error, request);
  }
};

/**
 * Get default values for workflow variables
 */
const getDefaultVariables = (
  variableDefinitions?: Record<string, { defaultValue?: unknown }>
): Record<string, unknown> => {
  if (!variableDefinitions) {
    return {};
  }

  const defaults: Record<string, unknown> = {};
  for (const [key, def] of Object.entries(variableDefinitions)) {
    if (def.defaultValue !== undefined) {
      defaults[key] = def.defaultValue;
    }
  }
  return defaults;
};

app.http('TriggerWorkflow', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'workflows/{workflowId}/trigger',
  handler
});

