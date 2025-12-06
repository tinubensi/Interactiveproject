import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyAccessToken } from '../lib/tokenService';
import { getAccessTokenFromCookies } from '../lib/cookieHelper';
import { getSessionsByUserId, toSessionInfo } from '../lib/sessionRepository';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';

/**
 * GetSessions - List all active sessions for current user
 * 
 * Route: GET /api/auth/sessions
 * Cookies: nectaria_access_token (required)
 * Response: List of active sessions
 */
export async function GetSessions(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`GetSessions: Processing request`);
  
  const config = getConfig();
  
  try {
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
    
    // Get all sessions for user
    const sessions = await getSessionsByUserId(decoded.sub);
    
    // Convert to client-safe format
    const sessionInfos = sessions.map(session => 
      toSessionInfo(session, decoded.sid)
    );
    
    return {
      status: 200,
      jsonBody: {
        sessions: sessionInfos,
      },
    };
  } catch (error) {
    context.error(`GetSessions: Error getting sessions`, error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'server_error',
        message: 'Failed to get sessions',
      },
    };
  }
}

app.http('GetSessions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/sessions',
  handler: GetSessions,
});
