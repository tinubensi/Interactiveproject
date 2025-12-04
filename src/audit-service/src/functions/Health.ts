/**
 * Health Check Handler
 * GET /api/audit/health
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { checkCosmosHealth } from '../lib/cosmosClient';

export async function HealthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Health function processing request');

  try {
    // Check Cosmos DB health
    const cosmosHealth = await checkCosmosHealth();

    const isHealthy = cosmosHealth.healthy;

    const healthResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'audit-service',
      version: '1.0.0',
      checks: {
        cosmosDb: {
          status: cosmosHealth.healthy ? 'healthy' : 'unhealthy',
          database: cosmosHealth.database,
          containers: cosmosHealth.containers,
          error: cosmosHealth.error,
        },
      },
    };

    return {
      status: isHealthy ? 200 : 503,
      jsonBody: healthResponse,
    };
  } catch (error) {
    context.error('Health check error:', error);

    return {
      status: 503,
      jsonBody: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        service: 'audit-service',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('Health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'audit/health',
  handler: HealthHandler,
});

