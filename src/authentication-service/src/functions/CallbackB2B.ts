import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { verifyState } from '../lib/pkceHelper';
import {
  getPkceVerifierFromCookies,
  createAccessTokenCookie,
  createRefreshTokenCookie,
  clearPkceVerifierCookie,
} from '../lib/cookieHelper';
import { exchangeCodeForTokens, mapGroupsToRoles, validateTenant } from '../lib/azureAdClient';
import { generateAccessToken, generateRefreshToken, hashToken } from '../lib/tokenService';
import { createSession } from '../lib/sessionRepository';
import { publishUserLoggedInEvent, publishSessionCreatedEvent, createBaseEventData } from '../lib/eventPublisher';
import { getConfig } from '../lib/config';
import { TOKEN_CONFIG } from '../models/TokenPayload';

/**
 * CallbackB2B - Handle Azure AD callback after authentication
 * 
 * Route: GET /api/auth/callback/b2b
 * Query Params:
 *   - code: Authorization code from Azure AD
 *   - state: State parameter for CSRF validation
 *   - error: Error code (if failed)
 *   - error_description: Error description (if failed)
 * Response: 302 Redirect to original destination or error page
 */
export async function CallbackB2B(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`CallbackB2B: Processing callback`);
  
  const config = getConfig();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  try {
    // Check for Azure AD errors
    const error = request.query.get('error');
    const errorDescription = request.query.get('error_description');
    
    if (error) {
      context.error(`CallbackB2B: Azure AD error - ${error}: ${errorDescription}`);
      return redirectToError(frontendUrl, error, errorDescription || 'Authentication failed');
    }
    
    // Get authorization code
    const code = request.query.get('code');
    if (!code) {
      context.error(`CallbackB2B: Missing authorization code`);
      return redirectToError(frontendUrl, 'missing_code', 'Authorization code not provided');
    }
    
    // Validate state parameter
    const state = request.query.get('state');
    if (!state) {
      context.error(`CallbackB2B: Missing state parameter`);
      return redirectToError(frontendUrl, 'missing_state', 'State parameter not provided');
    }
    
    const stateResult = verifyState(state, config.tokens.jwtSecret);
    if (!stateResult.valid) {
      context.error(`CallbackB2B: Invalid state parameter - possible CSRF attack`);
      return redirectToError(frontendUrl, 'invalid_state', 'Invalid state parameter');
    }
    
    const redirectUri = stateResult.redirectUri || '/dashboard';
    context.log(`CallbackB2B: State verified, redirect URI: ${redirectUri}`);
    
    // Get PKCE verifier from cookie
    const cookieHeader = request.headers.get('cookie');
    const codeVerifier = getPkceVerifierFromCookies(cookieHeader);
    
    if (!codeVerifier) {
      context.error(`CallbackB2B: Missing PKCE verifier cookie`);
      return redirectToError(frontendUrl, 'missing_verifier', 'PKCE verifier not found');
    }
    
    // Exchange code for tokens
    context.log(`CallbackB2B: Exchanging code for tokens`);
    const tokenResponse = await exchangeCodeForTokens(code, codeVerifier);
    
    // Validate tenant
    if (!validateTenant(tokenResponse.userInfo.tenantId)) {
      context.error(`CallbackB2B: Invalid tenant - ${tokenResponse.userInfo.tenantId}`);
      return redirectToError(frontendUrl, 'invalid_tenant', 'Unauthorized tenant');
    }
    
    // Map Azure AD groups to application roles
    const azureAdGroups = tokenResponse.userInfo.groups || [];
    const roles = mapGroupsToRoles(azureAdGroups);
    context.log(`CallbackB2B: Mapped roles: ${roles.join(', ')}`);
    
    // Generate application tokens
    const userId = tokenResponse.userInfo.oid;
    const tokenConfig = {
      jwtSecret: config.tokens.jwtSecret,
      accessTokenLifetime: config.tokens.accessTokenLifetime,
      refreshTokenLifetime: config.tokens.refreshTokenLifetime,
      issuer: TOKEN_CONFIG.issuer,
    };
    
    // We'll create the session first to get the session ID
    const sessionId = generateSessionId();
    
    const accessToken = generateAccessToken({
      userId,
      email: tokenResponse.userInfo.email,
      name: tokenResponse.userInfo.name,
      roles,
      azureAdGroups,
      organizationId: tokenResponse.userInfo.tenantId,
      sessionId,
    }, tokenConfig);
    
    const refreshToken = generateRefreshToken(userId, sessionId, tokenConfig);
    
    // Extract refresh token family from the generated token
    const refreshTokenFamily = hashToken(refreshToken).substring(0, 36); // Use first 36 chars as family ID
    
    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    
    // Create session in database
    context.log(`CallbackB2B: Creating session for user ${userId}`);
    const session = await createSession(
      {
        userId,
        email: tokenResponse.userInfo.email,
        name: tokenResponse.userInfo.name,
        authMethod: 'b2b_sso',
        azureAdGroups,
        organizationId: tokenResponse.userInfo.tenantId,
        ipAddress,
        userAgent,
      },
      accessToken,
      refreshToken,
      refreshTokenFamily
    );
    
    // Publish events
    const baseEventData = createBaseEventData();
    
    await publishUserLoggedInEvent({
      ...baseEventData,
      userId,
      email: tokenResponse.userInfo.email,
      name: tokenResponse.userInfo.name,
      authMethod: 'b2b_sso',
      sessionId: session.sessionId,
      azureAdGroups,
      ipAddress,
      userAgent,
      loginTime: new Date().toISOString(),
    });
    
    await publishSessionCreatedEvent({
      ...baseEventData,
      userId,
      email: tokenResponse.userInfo.email,
      sessionId: session.sessionId,
      deviceInfo: session.deviceInfo,
      expiresAt: session.expiresAt,
    });
    
    // Create cookies
    const accessTokenCookie = createAccessTokenCookie(accessToken);
    const refreshTokenCookie = createRefreshTokenCookie(refreshToken);
    const clearPkceCookie = clearPkceVerifierCookie();
    
    // Redirect to original destination
    const fullRedirectUrl = `${frontendUrl}${redirectUri}`;
    context.log(`CallbackB2B: Login successful, redirecting to ${fullRedirectUrl}`);
    
    return {
      status: 302,
      headers: {
        'Location': fullRedirectUrl,
        'Cache-Control': 'no-store',
      },
      cookies: [accessTokenCookie, refreshTokenCookie, clearPkceCookie],
    };
  } catch (error) {
    context.error(`CallbackB2B: Error processing callback`, error);
    
    return redirectToError(
      frontendUrl,
      'callback_error',
      error instanceof Error ? error.message : 'Authentication callback failed'
    );
  }
}

/**
 * Generate a session ID
 */
function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Helper to redirect to error page
 */
function redirectToError(
  frontendUrl: string,
  error: string,
  description: string
): HttpResponseInit {
  const errorUrl = `${frontendUrl}/login?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(description)}`;
  
  return {
    status: 302,
    headers: {
      'Location': errorUrl,
      'Cache-Control': 'no-store',
    },
    cookies: [clearPkceVerifierCookie()],
  };
}

app.http('CallbackB2B', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/callback/b2b',
  handler: CallbackB2B,
});
