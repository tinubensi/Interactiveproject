/**
 * Durable Functions Status Query
 * Get the status of a running orchestration
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function getOrchestrationStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Get orchestration instance ID from route params
    const instanceId = request.params.instanceId;

    if (!instanceId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'instanceId is required'
        }
      });
    }

    context.log(`Querying status for orchestration ${instanceId}`);

    // Get Durable Functions client
    const client = df.getClient(context);

    // Get orchestration status
    const status = await client.getStatus(instanceId);

    if (!status) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Orchestration not found',
          instanceId
        }
      });
    }

    context.log(`Orchestration ${instanceId} status: ${status.runtimeStatus}`);

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        instanceId: status.instanceId,
        runtimeStatus: status.runtimeStatus,
        input: status.input,
        output: status.output,
        createdTime: status.createdTime,
        lastUpdatedTime: status.lastUpdatedTime,
        customStatus: status.customStatus
      }
    });

  } catch (error: any) {
    context.error('Error querying orchestration status:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to query orchestration status',
        details: error.message
      }
    });
  }
}

app.http('getOrchestrationStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'orchestrations/status/{instanceId}',
  handler: getOrchestrationStatus
});











