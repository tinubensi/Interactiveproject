/**
 * Get Next Step API
 * GET /api/instances/lead/:leadId/next-step
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getInstanceByLeadId } from '../../repositories/instanceRepository';
import { getPipeline } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import type { NextStepInfo, PipelineStep, StageStep } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_READ);

    const leadId = request.params.leadId;
    if (!leadId) {
      return errorResponse(request, 'Lead ID is required', 400);
    }

    const instance = await getInstanceByLeadId(leadId);

    if (!instance) {
      const result: NextStepInfo = {
        leadId,
        hasActivePipeline: false,
      };
      return successResponse(request, result);
    }

    // Get the pipeline to find next step details
    const pipeline = await getPipeline(instance.pipelineId);
    const sortedSteps = [...pipeline.steps].sort((a, b) => a.order - b.order);
    
    // Find next stage step (if exists)
    let nextStageId: string | undefined;
    let nextStageName: string | undefined;
    
    if (instance.nextStepId) {
      const nextStep = sortedSteps.find(s => s.id === instance.nextStepId);
      if (nextStep?.type === 'stage') {
        const stageStep = nextStep as StageStep;
        nextStageId = stageStep.stageId;
        nextStageName = stageStep.stageName;
      } else if (nextStep) {
        // Find the next stage step after this one
        const nextStepIndex = sortedSteps.findIndex(s => s.id === instance.nextStepId);
        for (let i = nextStepIndex + 1; i < sortedSteps.length; i++) {
          if (sortedSteps[i].type === 'stage' && sortedSteps[i].enabled) {
            const stageStep = sortedSteps[i] as StageStep;
            nextStageId = stageStep.stageId;
            nextStageName = stageStep.stageName;
            break;
          }
        }
      }
    }

    // Determine what the instance is waiting for
    let waitingFor: string | undefined;
    if (instance.status === 'waiting_approval') {
      waitingFor = 'approval';
    } else if (instance.status === 'waiting_event') {
      waitingFor = instance.waitingForEvent;
    }

    const result: NextStepInfo = {
      leadId,
      hasActivePipeline: true,
      instanceId: instance.instanceId,
      currentStepId: instance.currentStepId,
      currentStepType: instance.currentStepType,
      currentStageName: instance.currentStageName,
      currentStageId: instance.currentStageId,
      nextStepId: instance.nextStepId,
      nextStepType: instance.nextStepType,
      nextStageName: nextStageName || instance.nextStageName,
      nextStageId,
      progressPercent: instance.progressPercent,
      status: instance.status,
      waitingFor,
    };

    return successResponse(request, result);
  } catch (error: any) {
    context.error('Get next step error:', error);
    return errorResponse(request, error.message || 'Failed to get next step', 500);
  }
}

app.http('GetNextStep', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/lead/{leadId}/next-step',
  handler,
});

