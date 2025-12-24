/**
 * Detect Stuck Pipeline Instances
 * Admin endpoint to find instances that haven't progressed for a long time
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';
import { getCosmosClient } from '../../lib/cosmosClient';

/**
 * Detect stuck pipeline instances
 * GET /api/admin/stuck-instances?hoursAgo=24
 */
async function handler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Get the threshold in hours (default: 24 hours)
    const hoursAgoParam = request.query.get('hoursAgo');
    const hoursAgo = hoursAgoParam ? parseInt(hoursAgoParam, 10) : 24;

    if (isNaN(hoursAgo) || hoursAgo < 1) {
      return errorResponse(request, 'hoursAgo must be a positive number', 400);
    }

    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    context.log(`[STUCK DETECTION] Searching for instances stuck since ${cutoffTime} (${hoursAgo} hours ago)`);

    // Query Cosmos DB for stuck instances
    const cosmosClient = getCosmosClient();
    const container = cosmosClient
      .database(process.env.COSMOS_DATABASE_ID || 'pipeline-db')
      .container('pipeline-instances');

    const querySpec = {
      query: `
        SELECT * FROM c 
        WHERE c.status = 'active' 
          AND c.updatedAt < @cutoffTime
          AND (c.waitingForEvent != null OR c.waitingForAction != null OR c.waitingForApprovalId != null)
        ORDER BY c.updatedAt ASC
      `,
      parameters: [
        { name: '@cutoffTime', value: cutoffTime },
      ],
    };

    const { resources: stuckInstances } = await container.items
      .query(querySpec)
      .fetchAll();

    context.log(`[STUCK DETECTION] Found ${stuckInstances.length} stuck instances`);

    // Format the results
    const results = stuckInstances.map((instance: any) => {
      const updatedAt = new Date(instance.updatedAt);
      const hoursStuck = Math.round((Date.now() - updatedAt.getTime()) / (1000 * 60 * 60));
      const minutesStuck = Math.round((Date.now() - updatedAt.getTime()) / (1000 * 60));

      return {
        instanceId: instance.instanceId,
        leadId: instance.leadId,
        pipelineId: instance.pipelineId,
        pipelineName: instance.pipelineName,
        status: instance.status,
        currentStage: instance.currentStageName || 'N/A',
        currentStepId: instance.currentStepId,
        currentStepType: instance.currentStepType,
        waitingFor: {
          event: instance.waitingForEvent || null,
          action: instance.waitingForAction || null,
          approval: instance.waitingForApprovalId || null,
          service: instance.waitingForService || null,
        },
        progress: {
          percent: instance.progressPercent || 0,
          completed: instance.completedStepsCount || 0,
          total: instance.totalStepsCount || 0,
        },
        timing: {
          lastUpdated: instance.updatedAt,
          hoursStuck,
          minutesStuck,
          createdAt: instance.createdAt,
        },
        diagnostics: {
          actionDeadline: instance.actionDeadline || null,
          actionStartedAt: instance.actionStartedAt || null,
          actionCorrelationId: instance.actionCorrelationId || null,
          nextStepId: instance.nextStepId || null,
          nextStepType: instance.nextStepType || null,
        },
      };
    });

    // Group by waiting condition
    const summary = {
      total: results.length,
      byWaitingCondition: {
        event: results.filter((r: any) => r.waitingFor.event).length,
        action: results.filter((r: any) => r.waitingFor.action).length,
        approval: results.filter((r: any) => r.waitingFor.approval).length,
      },
      byDuration: {
        moreThan24Hours: results.filter((r: any) => r.timing.hoursStuck > 24).length,
        moreThan48Hours: results.filter((r: any) => r.timing.hoursStuck > 48).length,
        moreThan72Hours: results.filter((r: any) => r.timing.hoursStuck > 72).length,
      },
      oldestInstance: results.length > 0 ? {
        instanceId: results[0].instanceId,
        hoursStuck: results[0].timing.hoursStuck,
      } : null,
    };

    return successResponse(request, {
      query: {
        hoursAgo,
        cutoffTime,
      },
      summary,
      instances: results,
    });
  } catch (error) {
    context.error('[STUCK DETECTION] Error detecting stuck instances:', error);
    return errorResponse(request, String(error), 500);
  }
}

// Register the HTTP function
app.http('DetectStuckInstances', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'function',
  route: 'admin/stuck-instances',
  handler,
});

