import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import {
  createWorkflowFromTemplate,
  TemplateNotFoundError,
} from '../../lib/repositories/templateRepository';
import { createdResponse, handleError, notFoundResponse, badRequestResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getTelemetry } from '../../lib/telemetry';
import { getUserFromRequest } from '../../lib/utils/auth';
import type { CreateFromTemplateRequest } from '../../models/workflowTypes';

export async function createFromTemplateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  const telemetry = getTelemetry();
  const startTime = Date.now();

  try {
    const user = await getUserFromRequest(request);
    const templateId = request.params.templateId;

    if (!templateId) {
      return withCors(request, badRequestResponse('Template ID is required', undefined, request));
    }

    const body = (await request.json()) as Omit<CreateFromTemplateRequest, 'templateId'>;

    // Validate required fields
    if (!body.name?.trim()) {
      return withCors(request, badRequestResponse('Workflow name is required', undefined, request));
    }

    if (!body.organizationId?.trim()) {
      return withCors(request, badRequestResponse('Organization ID is required', undefined, request));
    }

    const workflow = await createWorkflowFromTemplate(
      {
        templateId,
        name: body.name,
        description: body.description,
        organizationId: body.organizationId,
        configuration: body.configuration,
      },
      user.userId
    );

    telemetry?.trackEvent('WorkflowCreatedFromTemplate', {
      templateId,
      workflowId: workflow.workflowId,
      organizationId: body.organizationId,
      createdBy: user.userId,
    });

    telemetry?.trackMetric('templates.createWorkflow.duration', Date.now() - startTime);

    return withCors(request, createdResponse(workflow, request));
  } catch (error) {
    if (error instanceof TemplateNotFoundError) {
      return withCors(request, notFoundResponse('Template', request));
    }

    telemetry?.trackException(error as Error, {
      operation: 'createFromTemplate',
      templateId: request.params.templateId,
    });
    return withCors(request, handleError(error, request));
  }
}

app.http('createFromTemplate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'templates/{templateId}/create-workflow',
  handler: createFromTemplateHandler,
});

