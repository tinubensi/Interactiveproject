import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyAccessToken } from '../lib/tokenService';
import {
  getAccessTokenFromCookies,
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
} from '../lib/cookieHelper';
import { deleteAllUserSessions } from '../lib/sessionRepository';
import { publishUserLoggedOutEvent, createBaseEventData } from '../lib/eventPublisher';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';

/**
 * LogoutAll - Logout from all sessions/devices
 * 
 * Route: POST /api/auth/logout/all
 * Cookies: nectaria_access_token (required)
 * Response: Logout confirmation with count of invalidated sessions
 */
export async function LogoutAll(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`LogoutAll: Processing logout all request`);
  
  const config = getConfig();
  
  try {
    // Get access token from cookie
    const cookieHeader = request.headers.get('cookie');
    const accessToken = getAccessTokenFromCookies(cookieHeader);
    
    if (!accessToken) {
      context.warn(`LogoutAll: No access token found`);
      return {
        status: 401,
        jsonBody: {
          error: 'unauthorized',
          message: 'No active session',
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
      context.warn(`LogoutAll: Invalid access token`);
      return {
        status: 401,
        jsonBody: {
          error: 'unauthorized',
          message: 'Invalid access token',
        },
        cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
      };
    }
    
    // Delete all sessions for this user
    const deletedCount = await deleteAllUserSessions(decoded.sub);
    context.log(`LogoutAll: Deleted ${deletedCount} sessions for user ${decoded.sub}`);
    
    // Publish logout event
    const baseEventData = createBaseEventData();
    await publishUserLoggedOutEvent({
      ...baseEventData,
      userId: decoded.sub,
      email: decoded.email,
      sessionId: decoded.sid,
      logoutType: 'all_sessions',
      sessionsInvalidated: deletedCount,
    });
    
    return {
      status: 200,
      jsonBody: {
        message: 'Logged out from all devices',
        sessionsInvalidated: deletedCount,
      },
      cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
    };
  } catch (error) {
    context.error(`LogoutAll: Error processing logout all`, error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'logout_error',
        message: 'Failed to logout from all devices',
      },
    };
  }
}

app.http('LogoutAll', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout/all',
  handler: LogoutAll,
});
