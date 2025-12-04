/**
 * Health Check Handler
 * GET /api/notifications/health
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { checkCosmosHealth } from '../lib/cosmosClient';

export async function HealthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Health check request');

  try {
    // Check Cosmos DB health
    const cosmosHealth = await checkCosmosHealth();

    const healthy = cosmosHealth.healthy;

    return {
      status: healthy ? 200 : 503,
      jsonBody: {
        service: 'notification-service',
        status: healthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          cosmosDb: cosmosHealth,
        },
      },
    };
  } catch (error) {
    context.error('Health check error:', error);

    return {
      status: 503,
      jsonBody: {
        service: 'notification-service',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('Health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'notifications/health',
  handler: HealthHandler,
});

