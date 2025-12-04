import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyAccessToken } from '../lib/tokenService';
import { getAccessTokenFromCookies } from '../lib/cookieHelper';
import { deleteSession, getSessionById } from '../lib/sessionRepository';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';

/**
 * DeleteSession - Invalidate a specific session
 * 
 * Route: DELETE /api/auth/sessions/{sessionId}
 * Cookies: nectaria_access_token (required)
 * Response: Confirmation of session deletion
 */
export async function DeleteSession(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const sessionId = request.params.sessionId;
  context.log(`DeleteSession: Processing request for session ${sessionId}`);
  
  const config = getConfig();
  
  try {
    if (!sessionId) {
      return {
        status: 400,
        jsonBody: {
          error: 'bad_request',
          message: 'Session ID is required',
        },
      };
    }
    
    // Get access token from cookie
    const cookieHeader = request.headers.get('cookie');
    const accessToken = getAccessTokenFromCookies(cookieHeader);
    
    if (!accessToken) {
      return {
        status: 401,
        jsonBody: {
          error: 'unauthorized',
          message: 'Authentication required',
        },
      };
    }
    
    // Verify the access token
    const tokenConfig = {
      jwtSecret: config.tokens.jwtSecret,
      accessTokenLifetime: config.tokens.accessTokenLifetime,
      refreshTokenLifetime: config.tokens.refreshTokenLifetime,
      issuer: TOKEN_CONFIG.issuer,
    };
    
    const decoded = verifyAccessToken(accessToken, tokenConfig);
    
    if (!decoded) {
      return {
        status: 401,
        jsonBody: {
          error: 'unauthorized',
          message: 'Invalid or expired token',
        },
      };
    }
    
    // Prevent deleting current session via this endpoint
    if (sessionId === decoded.sid) {
      return {
        status: 400,
        jsonBody: {
          error: 'bad_request',
          message: 'Cannot delete current session. Use /auth/logout instead.',
        },
      };
    }
    
    // Check if session exists and belongs to user
    const session = await getSessionById(sessionId, decoded.sub);
    
    if (!session) {
      return {
        status: 404,
        jsonBody: {
          error: 'not_found',
          message: 'Session not found',
        },
      };
    }
    
    // Delete the session
    const deleted = await deleteSession(sessionId, decoded.sub);
    
    if (!deleted) {
      return {
        status: 404,
        jsonBody: {
          error: 'not_found',
          message: 'Session not found or already deleted',
        },
      };
    }
    
    context.log(`DeleteSession: Deleted session ${sessionId}`);
    
    return {
      status: 200,
      jsonBody: {
        message: 'Session invalidated',
      },
    };
  } catch (error) {
    context.error(`DeleteSession: Error deleting session`, error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'server_error',
        message: 'Failed to delete session',
      },
    };
  }
}

app.http('DeleteSession', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'auth/sessions/{sessionId}',
  handler: DeleteSession,
});
