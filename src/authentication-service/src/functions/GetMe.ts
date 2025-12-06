import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyAccessToken } from '../lib/tokenService';
import { getAccessTokenFromCookies } from '../lib/cookieHelper';
import { getSessionById } from '../lib/sessionRepository';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG, UserContext } from '../models/TokenPayload';

/**
 * GetMe - Get current authenticated user info
 * 
 * Route: GET /api/auth/me
 * Cookies: nectaria_access_token (required)
 * Response: Current user context
 */
export async function GetMe(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`GetMe: Processing request`);
  
  const config = getConfig();
  
  try {
    // Get access token from cookie or Authorization header
    const cookieHeader = request.headers.get('cookie');
    let accessToken = getAccessTokenFromCookies(cookieHeader);
    
    // Also check Authorization header
    if (!accessToken) {
      const authHeader = request.headers.get('authorization');
      if (authHeader?.startsWith('Bearer ')) {
        accessToken = authHeader.substring(7);
      }
    }
    
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
    
    // Get session for additional info
    const session = await getSessionById(decoded.sid, decoded.sub);
    
    if (!session) {
      return {
        status: 401,
        jsonBody: {
          error: 'unauthorized',
          message: 'Session not found',
        },
      };
    }
    
    // Build user context response
    const userContext: UserContext = {
      id: decoded.sub,
      email: decoded.email,
      name: decoded.name,
      azureAdGroups: decoded.groups,
      roles: decoded.roles,
      organizationId: decoded.orgId,
      authMethod: session.authMethod,
      sessionId: decoded.sid,
      lastLogin: session.createdAt,
    };
    
    return {
      status: 200,
      jsonBody: userContext,
    };
  } catch (error) {
    context.error(`GetMe: Error getting user info`, error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'server_error',
        message: 'Failed to get user info',
      },
    };
  }
}

app.http('GetMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/me',
  handler: GetMe,
});
