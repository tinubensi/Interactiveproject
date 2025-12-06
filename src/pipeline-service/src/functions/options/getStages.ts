/**
 * Get Stages Options API
 * GET /api/options/stages
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { PREDEFINED_STAGES, getStagesForLOB } from '../../constants/predefined';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import type { LineOfBusiness } from '../../models/pipeline';

async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Optional filter by LOB
    const lineOfBusiness = request.query.get('lineOfBusiness') as LineOfBusiness | null;

    const stages = lineOfBusiness 
      ? getStagesForLOB(lineOfBusiness)
      : PREDEFINED_STAGES;

    return successResponse(request, {
      stages: stages.map(stage => ({
        id: stage.id,
        name: stage.name,
        description: stage.description,
        icon: stage.icon,
        triggerEvent: stage.triggerEvent,
        progressPercent: stage.progressPercent,
        order: stage.order,
      })),
      count: stages.length,
    });
  } catch (error: any) {
    context.error('Get stages error:', error);
    return errorResponse(request, error.message || 'Failed to get stages', 500);
  }
}

app.http('GetStages', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'options/stages',
  handler,
});

