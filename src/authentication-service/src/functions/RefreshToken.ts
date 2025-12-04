import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
  hashToken,
  getTokenFamily,
} from '../lib/tokenService';
import {
  getRefreshTokenFromCookies,
  createAccessTokenCookie,
  createRefreshTokenCookie,
  clearAccessTokenCookie,
  clearRefreshTokenCookie,
} from '../lib/cookieHelper';
import {
  getSessionById,
  updateSessionTokens,
  verifyRefreshTokenFamily,
  deleteAllUserSessions,
} from '../lib/sessionRepository';
import { publishTokenRefreshedEvent, publishUserLoggedOutEvent, createBaseEventData } from '../lib/eventPublisher';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';

/**
 * RefreshToken - Refresh access token using refresh token
 * 
 * Route: POST /api/auth/refresh
 * Cookies: nectaria_refresh_token (required)
 * Response: New tokens set in cookies
 */
export async function RefreshToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`RefreshToken: Processing token refresh`);
  
  const config = getConfig();
  
  try {
    // Get refresh token from cookie
    const cookieHeader = request.headers.get('cookie');
    const refreshToken = getRefreshTokenFromCookies(cookieHeader);
    
    if (!refreshToken) {
      context.warn(`RefreshToken: Missing refresh token cookie`);
      return {
        status: 401,
        jsonBody: {
          error: 'invalid_refresh_token',
          message: 'Refresh token is required',
        },
      };
    }
    
    // Verify the refresh token
    const tokenConfig = {
      jwtSecret: config.tokens.jwtSecret,
      accessTokenLifetime: config.tokens.accessTokenLifetime,
      refreshTokenLifetime: config.tokens.refreshTokenLifetime,
      issuer: TOKEN_CONFIG.issuer,
    };
    
    const decoded = verifyRefreshToken(refreshToken, tokenConfig);
    
    if (!decoded) {
      context.warn(`RefreshToken: Invalid refresh token`);
      return {
        status: 401,
        jsonBody: {
          error: 'invalid_refresh_token',
          message: 'Refresh token is invalid or expired',
        },
        cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
      };
    }
    
    // Get session
    const session = await getSessionById(decoded.sid, decoded.sub);
    
    if (!session) {
      context.warn(`RefreshToken: Session not found - ${decoded.sid}`);
      return {
        status: 401,
        jsonBody: {
          error: 'invalid_refresh_token',
          message: 'Session not found',
        },
        cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
      };
    }
    
    // Verify token family (detect reuse attack)
    // Token family should match the one stored in the session
    const currentTokenHash = hashToken(refreshToken);
    if (session.refreshTokenHash !== currentTokenHash) {
      // Token reuse detected! Someone is using an old token.
      // This could be an attack - invalidate ALL sessions for this user
      context.error(`RefreshToken: TOKEN REUSE DETECTED for user ${decoded.sub}`);
      
      const deletedSessions = await deleteAllUserSessions(decoded.sub);
      
      // Publish security event
      const baseEventData = createBaseEventData();
      await publishUserLoggedOutEvent({
        ...baseEventData,
        userId: decoded.sub,
        email: session.email,
        sessionId: decoded.sid,
        logoutType: 'token_reuse_detected',
        sessionsInvalidated: deletedSessions,
      });
      
      return {
        status: 401,
        jsonBody: {
          error: 'token_reuse_detected',
          message: 'Security alert: Token reuse detected. All sessions have been invalidated.',
        },
        cookies: [clearAccessTokenCookie(), clearRefreshTokenCookie()],
      };
    }
    
    // Generate new tokens
    const newAccessToken = generateAccessToken({
      userId: decoded.sub,
      email: session.email,
      name: session.name,
      roles: [], // Will be fetched from authz service by caller
      azureAdGroups: session.azureAdGroups,
      organizationId: session.organizationId,
      sessionId: decoded.sid,
    }, tokenConfig);
    
    const newRefreshToken = generateRefreshToken(decoded.sub, decoded.sid, tokenConfig);
    const newRefreshTokenFamily = hashToken(newRefreshToken).substring(0, 36);
    
    // Update session with new tokens
    await updateSessionTokens(
      decoded.sid,
      decoded.sub,
      newAccessToken,
      newRefreshToken,
      newRefreshTokenFamily
    );
    
    // Publish event
    const baseEventData = createBaseEventData();
    await publishTokenRefreshedEvent({
      ...baseEventData,
      userId: decoded.sub,
      sessionId: decoded.sid,
      newExpiresAt: new Date(Date.now() + config.tokens.refreshTokenLifetime * 1000).toISOString(),
    });
    
    context.log(`RefreshToken: Tokens refreshed for user ${decoded.sub}`);
    
    return {
      status: 200,
      jsonBody: {
        expiresIn: config.tokens.accessTokenLifetime,
        tokenType: 'Bearer',
      },
      cookies: [
        createAccessTokenCookie(newAccessToken),
        createRefreshTokenCookie(newRefreshToken),
      ],
    };
  } catch (error) {
    context.error(`RefreshToken: Error refreshing token`, error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'refresh_error',
        message: 'Failed to refresh token',
      },
    };
  }
}

app.http('RefreshToken', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auth/refresh',
  handler: RefreshToken,
});
