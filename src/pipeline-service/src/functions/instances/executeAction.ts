/**
 * Execute Action API
 * POST /api/instances/lead/:leadId/actions/:actionType
 * Executes an action after validating it's allowed at current stage
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getInstanceByLeadId } from '../../repositories/instanceRepository';
import { getPipeline } from '../../repositories/pipelineRepository';
import { ensureAuthorized } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import { publishEvent } from '../../services/eventGridService';
import type { StageStep } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    const leadId = request.params.leadId;
    const actionType = request.params.actionType;
    const body = await request.json() as Record<string, unknown> | null;

    if (!leadId || !actionType) {
      return errorResponse(request, 'Lead ID and Action Type are required', 400);
    }

    // Get instance
    const instance = await getInstanceByLeadId(leadId);
    if (!instance) {
      return errorResponse(request, 'No active pipeline instance found', 404);
    }

    // Get pipeline and current step
    const pipeline = await getPipeline(instance.pipelineId);
    const currentStep = pipeline.steps.find(s => s.id === instance.currentStepId);

    if (!currentStep || currentStep.type !== 'stage') {
      return errorResponse(request, 'Current step is not a stage step', 400);
    }

    const stageStep = currentStep as StageStep;
    const allowedActions = stageStep.allowedActions || [];

    // VALIDATE: Check if action is allowed at current stage
    if (!allowedActions.includes(actionType)) {
      return errorResponse(
        request,
        `Action "${actionType}" is not allowed at stage "${stageStep.stageName}"`,
        403
      );
    }

    // Action is allowed - emit event for other services to handle
    // Map action types to event types
    const eventTypeMap: Record<string, string> = {
      'CREATE_QUOTATION': 'pipeline.action.create_quotation',
      'REFETCH_PLANS': 'pipeline.action.refetch_plans',
      'SEND_QUOTATION': 'pipeline.action.send_quotation',
      'MANUAL_ADVANCE': 'pipeline.manual_advance',
      // Add more mappings as needed
    };

    const eventType = eventTypeMap[actionType] || `pipeline.action.${actionType.toLowerCase()}`;

    await publishEvent(eventType, `lead/${leadId}`, {
      leadId,
      lineOfBusiness: instance.lineOfBusiness,
      actionType,
      currentStage: stageStep.stageName,
      currentStageId: stageStep.stageId,
      requestedBy: userContext.userId,
      requestedByName: userContext.name,
      ...(body || {}),
      timestamp: new Date().toISOString(),
    });

    context.log(`Action "${actionType}" executed for lead ${leadId} at stage ${stageStep.stageName}`);

    return successResponse(request, {
      success: true,
      message: `Action "${actionType}" executed successfully`,
      actionType,
      leadId,
    });
  } catch (error: any) {
    context.error('Execute action error:', error);
    return errorResponse(request, error.message || 'Failed to execute action', 500);
  }
}

app.http('ExecuteAction', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/lead/{leadId}/actions/{actionType}',
  handler: handler
});
