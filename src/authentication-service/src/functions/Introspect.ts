import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyAccessToken } from '../lib/tokenService';
import { getSessionById, updateSessionActivity } from '../lib/sessionRepository';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';
import type { IntrospectResponse } from '../models/TokenPayload';

/**
 * Introspect - Validate and decode token for service-to-service authentication
 * 
 * Route: POST /api/auth/introspect
 * Headers: X-Service-Key (required)
 * Body: { token: string }
 * Response: Token introspection response
 */
export async function Introspect(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const startTime = Date.now();
  context.log(`Introspect: Processing token introspection`);
  
  const config = getConfig();
  
  try {
    // Validate service key
    const serviceKey = request.headers.get('x-service-key');
    
    if (!serviceKey || serviceKey !== config.internalServiceKey) {
      context.warn(`Introspect: Invalid or missing service key`);
      return {
        status: 401,
        jsonBody: {
          error: 'unauthorized',
          message: 'Valid service key required',
        },
      };
    }
    
    // Parse request body
    const body = await request.json() as { token?: string };
    
    if (!body.token) {
      return {
        status: 400,
        jsonBody: {
          active: false,
          reason: 'token_invalid',
        } as IntrospectResponse,
      };
    }
    
    // Verify the token
    const tokenConfig = {
      jwtSecret: config.tokens.jwtSecret,
      accessTokenLifetime: config.tokens.accessTokenLifetime,
      refreshTokenLifetime: config.tokens.refreshTokenLifetime,
      issuer: TOKEN_CONFIG.issuer,
    };
    
    const decoded = verifyAccessToken(body.token, tokenConfig);
    
    if (!decoded) {
      context.log(`Introspect: Token verification failed`);
      return {
        status: 200,
        jsonBody: {
          active: false,
          reason: 'token_expired',
        } as IntrospectResponse,
      };
    }
    
    // Check if session exists and is valid
    const session = await getSessionById(decoded.sid, decoded.sub);
    
    if (!session) {
      context.log(`Introspect: Session not found - ${decoded.sid}`);
      return {
        status: 200,
        jsonBody: {
          active: false,
          reason: 'session_revoked',
        } as IntrospectResponse,
      };
    }
    
    // Check if session has expired
    if (new Date(session.expiresAt) < new Date()) {
      context.log(`Introspect: Session expired - ${decoded.sid}`);
      return {
        status: 200,
        jsonBody: {
          active: false,
          reason: 'session_revoked',
        } as IntrospectResponse,
      };
    }
    
    // Update session activity (async, don't wait)
    updateSessionActivity(decoded.sid, decoded.sub).catch(err => {
      context.warn(`Introspect: Failed to update session activity`, err);
    });
    
    // Build response
    const response: IntrospectResponse = {
      active: true,
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      roles: decoded.roles,
      azureAdGroups: decoded.groups,
      organizationId: decoded.orgId,
      sessionId: decoded.sid,
      iat: decoded.iat,
      exp: decoded.exp,
    };
    
    const duration = Date.now() - startTime;
    context.log(`Introspect: Token valid, response time: ${duration}ms`);
    
    // Log warning if response time exceeds target
    if (duration > 50) {
      context.warn(`Introspect: Response time ${duration}ms exceeds 50ms target`);
    }
    
    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error(`Introspect: Error processing introspection`, error);
    
    return {
      status: 200,
      jsonBody: {
        active: false,
        reason: 'token_invalid',
      } as IntrospectResponse,
    };
  }
}

app.http('Introspect', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/introspect',
  handler: Introspect,
});
