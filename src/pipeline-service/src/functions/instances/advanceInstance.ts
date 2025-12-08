/**
 * Advance Instance Function
 * Manually advances a pipeline instance that is waiting for manual_advance event
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getInstance, getInstanceByLeadId } from '../../repositories/instanceRepository';
import { processEvent } from '../../lib/orchestrator';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';

/**
 * POST /api/pipeline/instances/{instanceId}/advance
 * 
 * Manually advances a pipeline instance.
 * The instance must be in 'waiting_event' status with 'manual_advance' or 'pipeline.manual_advance' as the waiting event.
 * 
 * Request body (optional):
 * {
 *   "comment": "Reason for manual advancement"
 * }
 */
export async function advanceInstance(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Authorization
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_MANAGE);

    const instanceId = request.params.instanceId;
    if (!instanceId) {
      return errorResponse(request, 'instanceId is required', 400);
    }

    // Get instance
    const instance = await getInstance(instanceId);
    if (!instance) {
      return errorResponse(request, 'Instance not found', 404);
    }

    // Verify instance is waiting for manual advance
    const validWaitingEvents = ['manual_advance', 'pipeline.manual_advance'];
    if (instance.status !== 'waiting_event' || !validWaitingEvents.includes(instance.waitingForEvent || '')) {
      return errorResponse(
        request,
        `Instance is not waiting for manual advance. Current status: ${instance.status}, waiting for: ${instance.waitingForEvent || 'nothing'}`,
        400
      );
    }

    // Parse optional comment from body
    let comment: string | undefined;
    try {
      const body = await request.json() as { comment?: string };
      comment = body.comment;
    } catch {
      // No body or invalid JSON - that's fine, comment is optional
    }

    context.log(`Manually advancing instance ${instanceId} by user ${userContext.userId}`);
    if (comment) {
      context.log(`Reason: ${comment}`);
    }

    // Process the manual advance event
    const result = await processEvent(
      'pipeline.manual_advance',
      {
        leadId: instance.leadId,
        lineOfBusiness: instance.lineOfBusiness,
        instanceId,
        advancedBy: userContext.userId,
        comment,
      },
      { log: context.log.bind(context) }
    );

    if (!result.processed) {
      return errorResponse(
        request,
        `Failed to advance instance: ${result.error || 'Unknown error'}`,
        500
      );
    }

    // Get updated instance
    const updatedInstance = await getInstance(instanceId);

    return successResponse(request, {
      message: 'Instance advanced successfully',
      instanceId,
      previousStepId: instance.currentStepId,
      currentStepId: updatedInstance?.currentStepId,
      currentStageName: updatedInstance?.currentStageName,
      status: updatedInstance?.status,
      progressPercent: updatedInstance?.progressPercent,
    });
  } catch (error) {
    context.error('Error advancing instance:', error);
    return errorResponse(request, String(error), 500);
  }
}

app.http('AdvanceInstance', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipeline/instances/{instanceId}/advance',
  handler: advanceInstance,
});

/**
 * POST /api/pipeline/leads/{leadId}/advance
 * 
 * Convenience endpoint to advance a lead's active pipeline instance.
 */
export async function advanceLeadInstance(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Authorization
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_MANAGE);

    const leadId = request.params.leadId;
    if (!leadId) {
      return errorResponse(request, 'leadId is required', 400);
    }

    // Get instance by lead
    const instance = await getInstanceByLeadId(leadId);
    if (!instance) {
      return errorResponse(request, 'No active pipeline instance found for this lead', 404);
    }

    // Verify instance is waiting for manual advance
    const validWaitingEvents = ['manual_advance', 'pipeline.manual_advance'];
    if (instance.status !== 'waiting_event' || !validWaitingEvents.includes(instance.waitingForEvent || '')) {
      return errorResponse(
        request,
        `Instance is not waiting for manual advance. Current status: ${instance.status}, waiting for: ${instance.waitingForEvent || 'nothing'}`,
        400
      );
    }

    // Parse optional comment from body
    let comment: string | undefined;
    try {
      const body = await request.json() as { comment?: string };
      comment = body.comment;
    } catch {
      // No body or invalid JSON - that's fine
    }

    context.log(`Manually advancing lead ${leadId}'s pipeline by user ${userContext.userId}`);

    // Process the manual advance event
    const result = await processEvent(
      'pipeline.manual_advance',
      {
        leadId,
        lineOfBusiness: instance.lineOfBusiness,
        instanceId: instance.instanceId,
        advancedBy: userContext.userId,
        comment,
      },
      { log: context.log.bind(context) }
    );

    if (!result.processed) {
      return errorResponse(
        request,
        `Failed to advance instance: ${result.error || 'Unknown error'}`,
        500
      );
    }

    // Get updated instance
    const updatedInstance = await getInstance(instance.instanceId);

    return successResponse(request, {
      message: 'Lead pipeline advanced successfully',
      leadId,
      instanceId: instance.instanceId,
      currentStepId: updatedInstance?.currentStepId,
      currentStageName: updatedInstance?.currentStageName,
      status: updatedInstance?.status,
      progressPercent: updatedInstance?.progressPercent,
    });
  } catch (error) {
    context.error('Error advancing lead instance:', error);
    return errorResponse(request, String(error), 500);
  }
}

app.http('AdvanceLeadInstance', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'pipeline/leads/{leadId}/advance',
  handler: advanceLeadInstance,
});

