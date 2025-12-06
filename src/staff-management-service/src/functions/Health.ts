/**
 * Health Handler - GET /api/staff/health
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { checkCosmosHealth } from '../lib/cosmosClient';

export async function HealthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Health check invoked');

  try {
    // Check Cosmos DB connection
    const cosmosHealth = await checkCosmosHealth();

    const response = {
      status: cosmosHealth.healthy ? 'healthy' : 'unhealthy',
      service: 'staff-management-service',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      dependencies: {
        cosmosDb: {
          status: cosmosHealth.healthy ? 'connected' : 'disconnected',
          database: cosmosHealth.database,
          containers: cosmosHealth.containers,
          error: cosmosHealth.error,
        },
      },
    };

    return {
      status: cosmosHealth.healthy ? 200 : 503,
      jsonBody: response,
    };
  } catch (error) {
    context.error('Health check error:', error);
    return {
      status: 503,
      jsonBody: {
        status: 'unhealthy',
        service: 'staff-management-service',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('Health', {
  methods: ['GET'],
  route: 'staff/health',
  authLevel: 'anonymous',
  handler: HealthHandler,
});

