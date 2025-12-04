import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getCosmosClient } from '../lib/cosmosClient';
import { getConfig } from '../lib/config';

/**
 * Health check response
 */
interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  checks: {
    cosmosDb: 'ok' | 'error' | 'not_configured';
    azureAd: 'ok' | 'error' | 'not_configured';
    eventGrid: 'ok' | 'error' | 'not_configured';
  };
  version?: string;
  errors?: string[];
}

/**
 * Health - Service health check endpoint
 * 
 * Route: GET /api/auth/health
 * Response: Health status with dependency checks
 */
export async function Health(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Health: Processing health check`);
  
  const config = getConfig();
  const errors: string[] = [];
  
  const response: HealthCheckResponse = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {
      cosmosDb: 'not_configured',
      azureAd: 'not_configured',
      eventGrid: 'not_configured',
    },
    version: process.env.SERVICE_VERSION || '1.0.0',
  };
  
  // Check Cosmos DB
  if (config.cosmos.endpoint && config.cosmos.key) {
    try {
      const client = getCosmosClient();
      const { resource } = await client.database(config.cosmos.databaseId).read();
      response.checks.cosmosDb = resource ? 'ok' : 'error';
    } catch (error) {
      response.checks.cosmosDb = 'error';
      errors.push(`CosmosDB: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Check Azure AD configuration
  if (config.azureAd.tenantId && config.azureAd.clientId && config.azureAd.clientSecret) {
    // We can't easily test Azure AD connection without making a token request
    // So just verify configuration is present
    response.checks.azureAd = 'ok';
  } else {
    if (!config.azureAd.tenantId) errors.push('Azure AD: Missing tenant ID');
    if (!config.azureAd.clientId) errors.push('Azure AD: Missing client ID');
    if (!config.azureAd.clientSecret) errors.push('Azure AD: Missing client secret');
  }
  
  // Check Event Grid configuration
  if (config.eventGrid.topicEndpoint && config.eventGrid.topicKey) {
    response.checks.eventGrid = 'ok';
  }
  
  // Determine overall status
  const checkValues = Object.values(response.checks);
  if (checkValues.some(v => v === 'error')) {
    response.status = 'unhealthy';
  } else if (checkValues.some(v => v === 'not_configured')) {
    response.status = 'degraded';
  }
  
  if (errors.length > 0) {
    response.errors = errors;
  }
  
  const statusCode = response.status === 'healthy' ? 200 : 
                     response.status === 'degraded' ? 200 : 503;
  
  return {
    status: statusCode,
    jsonBody: response,
  };
}

app.http('Health', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/health',
  handler: Health,
});
