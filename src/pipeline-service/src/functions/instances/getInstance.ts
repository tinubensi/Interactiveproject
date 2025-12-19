/**
 * Get Instance API
 * GET /api/instances/:id
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getInstance, InstanceNotFoundError } from '../../repositories/instanceRepository';
import { getPipeline } from '../../repositories/pipelineRepository';
import { ensureAuthorized, requirePermission, PIPELINE_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, successResponse, errorResponse, notFoundResponse } from '../../utils/corsHelper';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, PIPELINE_PERMISSIONS.INSTANCES_READ);

    const instanceId = request.params.id;
    if (!instanceId) {
      return errorResponse(request, 'Instance ID is required', 400);
    }

    const instance = await getInstance(instanceId);

    // Fetch pipeline definition to get step names
    const pipeline = await getPipeline(instance.pipelineId);
    const currentStep = pipeline.steps.find(s => s.id === instance.currentStepId);
    const nextStep = instance.nextStepId
      ? pipeline.steps.find(s => s.id === instance.nextStepId)
      : null;

    // Enrich step history with stepName from pipeline definition (for backward compatibility)
    const enrichedStepHistory = instance.stepHistory.map(historyEntry => {
      // If stepName is already present, keep it
      if (historyEntry.stepName) {
        return historyEntry;
      }

      // Find matching step in pipeline definition
      const pipelineStep = pipeline.steps.find(s => s.id === historyEntry.stepId);
      if (pipelineStep) {
        // Determine step name based on step type
        let stepName: string | undefined;
        if (pipelineStep.type === 'stage') {
          const stageStep = pipelineStep as { stageName: string };
          stepName = stageStep.stageName;
        } else {
          stepName = pipelineStep.name;
        }

        return {
          ...historyEntry,
          stepName,
        };
      }

      // If step not found, return entry as-is
      return historyEntry;
    });

    const enrichedInstance = {
      ...instance,
      stepHistory: enrichedStepHistory,
      currentStepName: currentStep?.name || (currentStep?.type === 'stage' ? (currentStep as any).stageName : null) || instance.currentStepId,
      nextStepName: nextStep?.name || (nextStep?.type === 'stage' ? (nextStep as any).stageName : null) || instance.nextStepId,
    };

    return successResponse(request, { instance: enrichedInstance });
  } catch (error: any) {
    if (error instanceof InstanceNotFoundError) {
      return notFoundResponse(request, 'Instance');
    }
    context.error('Get instance error:', error);
    return errorResponse(request, error.message || 'Failed to get instance', 500);
  }
}

app.http('GetInstance', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'instances/{id}',
  handler,
});

