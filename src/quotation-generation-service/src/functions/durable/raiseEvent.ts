/**
 * Durable Functions Event Webhook
 * Allows external services (like RPA) to raise events to orchestrations
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { handlePreflight, withCors } from '../../utils/corsHelper';

export async function raiseEventWebhook(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Get orchestration instance ID from route params or query
    const instanceId = request.params.instanceId || request.query.get('instanceId');
    const eventName = request.params.eventName || request.query.get('eventName') || 'RPA_COMPLETED';

    if (!instanceId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'instanceId is required'
        }
      });
    }

    // Parse event data from body
    const eventData = await request.json();

    context.log(`Raising event "${eventName}" for orchestration ${instanceId}`);
    context.log(`Event data:`, eventData);

    // Get Durable Functions client
    const client = df.getClient(context);

    // Check if orchestration exists
    const status = await client.getStatus(instanceId);
    
    if (!status) {
      context.warn(`Orchestration ${instanceId} not found`);
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'Orchestration not found',
          instanceId
        }
      });
    }

    if (status.runtimeStatus === 'Completed' || status.runtimeStatus === 'Failed' || status.runtimeStatus === 'Terminated') {
      context.warn(`Orchestration ${instanceId} is already ${status.runtimeStatus}`);
      return withCors(request, {
        status: 409,
        jsonBody: {
          success: false,
          error: `Orchestration already ${status.runtimeStatus}`,
          instanceId,
          status: status.runtimeStatus
        }
      });
    }

    // Raise the event
    await client.raiseEvent(instanceId, eventName, eventData);

    context.log(`✅ Event "${eventName}" raised successfully for orchestration ${instanceId}`);

    return withCors(request, {
      status: 202, // Accepted
      jsonBody: {
        success: true,
        message: `Event "${eventName}" raised successfully`,
        instanceId,
        eventName,
        eventData
      }
    });

  } catch (error: any) {
    context.error('Error raising event:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to raise event',
        details: error.message
      }
    });
  }
}

app.http('raiseEventWebhook', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'orchestrations/{instanceId}/raiseEvent/{eventName?}',
  handler: raiseEventWebhook
});











