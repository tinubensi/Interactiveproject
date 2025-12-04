import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyAccessToken } from '../lib/tokenService';
import {
  getAccessTokenFromCookies,
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
} from '../lib/cookieHelper';
import { deleteSession, getSessionById } from '../lib/sessionRepository';
import { buildLogoutUrl } from '../lib/azureAdClient';
import { publishUserLoggedOutEvent, createBaseEventData } from '../lib/eventPublisher';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';

/**
 * Logout - Logout current session
 * 
 * Route: POST /api/auth/logout
 * Cookies: nectaria_access_token (required)
 * Response: Logout confirmation with Azure AD logout URL
 */
export async function Logout(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`Logout: Processing logout request`);
  
  const config = getConfig();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  try {
    // Get access token from cookie
    const cookieHeader = request.headers.get('cookie');
    const accessToken = getAccessTokenFromCookies(cookieHeader);
    
    if (!accessToken) {
      context.warn(`Logout: No access token found`);
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
      context.warn(`Logout: Invalid access token`);
      // Still clear cookies even if token is invalid
      return {
        status: 200,
        jsonBody: {
          message: 'Logged out',
        },
        cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
      };
    }
    
    // Get session info for event
    const session = await getSessionById(decoded.sid, decoded.sub);
    
    // Delete the session
    await deleteSession(decoded.sid, decoded.sub);
    context.log(`Logout: Deleted session ${decoded.sid}`);
    
    // Publish logout event
    const baseEventData = createBaseEventData();
    await publishUserLoggedOutEvent({
      ...baseEventData,
      userId: decoded.sub,
      email: decoded.email,
      sessionId: decoded.sid,
      logoutType: 'user_initiated',
      sessionsInvalidated: 1,
    });
    
    // Build Azure AD logout URL for SSO logout
    const azureLogoutUrl = buildLogoutUrl(`${frontendUrl}/login`);
    
    return {
      status: 200,
      jsonBody: {
        message: 'Logged out successfully',
        azureLogoutUrl,
      },
      cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
    };
  } catch (error) {
    context.error(`Logout: Error processing logout`, error);
    
    // Still clear cookies on error
    return {
      status: 200,
      jsonBody: {
        message: 'Logged out',
      },
      cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
    };
  }
}

app.http('Logout', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/logout',
  handler: Logout,
});
