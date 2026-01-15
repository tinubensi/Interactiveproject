/**
 * Durable Functions HTTP Starter
 * Entry point for plan fetching - starts orchestration and returns immediately
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import * as df from 'durable-functions';
import { handlePreflight, withCors } from '../../utils/corsHelper';
import { ensureAuthorized, requirePermission, QUOTE_PERMISSIONS, validateServiceKey } from '../../lib/auth';
import { FetchPlansRequest } from '../../models/plan';

export async function fetchPlansStarter(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Handle CORS preflight
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // Authentication
    const isServiceCall = validateServiceKey(request);
    if (!isServiceCall) {
      const userContext = await ensureAuthorized(request);
      await requirePermission(userContext.userId, QUOTE_PERMISSIONS.QUOTES_CREATE);
    } else {
      context.log('Plan fetch request authenticated via service key (internal service call)');
    }

    // Parse request body
    const body: FetchPlansRequest = await request.json() as FetchPlansRequest;

    if (!body.leadId || !body.lineOfBusiness) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'leadId and lineOfBusiness are required'
        }
      });
    }

    context.log(`Starting durable orchestration for lead ${body.leadId}`);

    // Create Durable Functions client
    const client = df.getClient(context);

    // Start orchestration
    const instanceId = await client.startNew('planFetchOrchestrator', {
      input: {
        leadId: body.leadId,
        lineOfBusiness: body.lineOfBusiness,
        businessType: body.businessType || 'individual',
        leadData: body.leadData,
        forceRefresh: body.forceRefresh || false,
        requestedAt: new Date().toISOString()
      }
    });

    context.log(`✅ Started orchestration with ID: ${instanceId}`);

    // Return immediately with orchestration info
    return withCors(request, {
      status: 202, // Accepted - processing asynchronously
      jsonBody: {
        success: true,
        message: 'Plan fetching started',
        orchestrationId: instanceId,
        leadId: body.leadId,
        statusQueryGetUri: `${request.url}/../status/${instanceId}`,
        sendEventPostUri: `${request.url}/../instances/${instanceId}/raiseEvent/{eventName}`,
        terminatePostUri: `${request.url}/../instances/${instanceId}/terminate`,
        estimatedCompletionTime: '2-3 minutes'
      }
    });

  } catch (error: any) {
    context.error('Error starting plan fetch orchestration:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to start plan fetching',
        details: error.message
      }
    });
  }
}

app.http('fetchPlansStarter', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'plans/fetch-durable',
  handler: fetchPlansStarter
});











