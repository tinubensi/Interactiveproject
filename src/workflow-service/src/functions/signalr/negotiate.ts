import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { successResponse, handleError, badRequestResponse, internalErrorResponse } from '../../lib/utils/httpResponses';
import { withCors, handlePreflight } from '../../lib/utils/corsHelper';
import { getConfig } from '../../lib/config';
import { getUserFromRequest } from '../../lib/utils/auth';

/**
 * SignalR negotiate endpoint
 * Returns connection info for clients to connect to SignalR
 */
export async function negotiateHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const config = getConfig();
    
    if (!config.signalr?.connectionString) {
      return withCors(
        request,
        internalErrorResponse('SignalR is not configured', request)
      );
    }

    const user = await getUserFromRequest(request);
    const hubName = config.signalr.hubName;
    
    // Parse the connection string to extract endpoint and key
    const connectionString = config.signalr.connectionString;
    const endpointMatch = connectionString.match(/Endpoint=([^;]+)/i);
    const keyMatch = connectionString.match(/AccessKey=([^;]+)/i);
    
    if (!endpointMatch || !keyMatch) {
      return withCors(
        request,
        internalErrorResponse('Invalid SignalR connection string', request)
      );
    }

    const endpoint = endpointMatch[1].replace(/^https?:\/\//, '');
    const accessKey = keyMatch[1];

    // Generate access token
    // Using JWT format expected by Azure SignalR
    const audience = `https://${endpoint}/client/?hub=${hubName}`;
    const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
    
    // Simple JWT token generation (in production, use a proper JWT library)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      aud: audience,
      exp: expiry,
      iat: Math.floor(Date.now() / 1000),
      nameid: user.userId,
    })).toString('base64url');
    
    const crypto = await import('crypto');
    const signature = crypto
      .createHmac('sha256', accessKey)
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    const accessToken = `${header}.${payload}.${signature}`;

    return withCors(
      request,
      successResponse({
        url: `https://${endpoint}/client/?hub=${hubName}`,
        accessToken,
      }, request)
    );
  } catch (error) {
    context.log('SignalR negotiate error:', error);
    return withCors(request, handleError(error, request));
  }
}

app.http('negotiate', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'signalr/negotiate',
  handler: negotiateHandler,
});

