/**
 * Pipeline Health Check Endpoint
 * Monitors pipeline coverage for leads
 * Used for alerting when leads don't have active pipelines
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { isLeadManagedByPipeline } from '../../services/pipelineServiceClient';
import { handlePreflight, successResponse, errorResponse } from '../../utils/corsHelper';

export async function pipelineHealthCheck(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Query for recent leads (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get leads created in the last 24 hours
    const querySpec = {
      query: `
        SELECT c.id, c.referenceId, c.lineOfBusiness, c.createdAt
        FROM c
        WHERE c.type = "lead"
          AND NOT IS_DEFINED(c.deletedAt)
          AND c.createdAt >= @cutoffDate
        ORDER BY c.createdAt DESC
      `,
      parameters: [{ name: '@cutoffDate', value: twentyFourHoursAgo }]
    };

    const container = (cosmosService as any).leadsContainer;
    const { resources: recentLeads } = await container.items.query(querySpec).fetchAll();

    if (recentLeads.length === 0) {
      return successResponse(request, {
        status: 'healthy',
        message: 'No recent leads to check',
        data: {
          leadsChecked: 0,
          leadsWithoutPipelines: 0,
          coverage: '100%'
        }
      });
    }

    // Check pipeline coverage for each lead
    const leadsWithoutPipelines: Array<{
      id: string;
      referenceId: string;
      lineOfBusiness: string;
      createdAt: string;
    }> = [];

    for (const lead of recentLeads) {
      try {
        const hasPipeline = await isLeadManagedByPipeline(lead.id);
        if (!hasPipeline) {
          leadsWithoutPipelines.push({
            id: lead.id,
            referenceId: lead.referenceId,
            lineOfBusiness: lead.lineOfBusiness,
            createdAt: lead.createdAt
          });
        }
      } catch (error: any) {
        context.warn(`Failed to check pipeline for lead ${lead.id}:`, error.message);
        // Count as missing pipeline for safety
        leadsWithoutPipelines.push({
          id: lead.id,
          referenceId: lead.referenceId,
          lineOfBusiness: lead.lineOfBusiness,
          createdAt: lead.createdAt
        });
      }
    }

    const leadsChecked = recentLeads.length;
    const leadsWithPipelines = leadsChecked - leadsWithoutPipelines.length;
    const coverage = leadsChecked > 0 ? ((leadsWithPipelines / leadsChecked) * 100).toFixed(1) + '%' : '100%';

    // Determine health status
    const isHealthy = leadsWithoutPipelines.length === 0;

    const response = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      message: isHealthy
        ? 'All recent leads have active pipelines'
        : `${leadsWithoutPipelines.length} out of ${leadsChecked} recent leads are missing pipeline instances`,
      timestamp: new Date().toISOString(),
      data: {
        leadsChecked,
        leadsWithPipelines,
        leadsWithoutPipelines: leadsWithoutPipelines.length,
        coverage,
        leadsWithoutPipelines: isHealthy ? [] : leadsWithoutPipelines
      }
    };

    // Log issues for monitoring
    if (!isHealthy) {
      context.error(`PIPELINE COVERAGE ALERT: ${leadsWithoutPipelines.length}/${leadsChecked} leads missing pipelines`);
      leadsWithoutPipelines.forEach(lead => {
        context.error(`Missing pipeline: ${lead.referenceId} (${lead.lineOfBusiness}) created ${lead.createdAt}`);
      });
    } else {
      context.log(`Pipeline coverage healthy: ${coverage} (${leadsWithPipelines}/${leadsChecked})`);
    }

    return successResponse(request, response);
  } catch (error: any) {
    context.error('Pipeline health check error:', error);
    return errorResponse(request, `Health check failed: ${error.message}`, 500);
  }
}

app.http('pipelineHealthCheck', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'health/pipeline-coverage',
  handler: pipelineHealthCheck
});
