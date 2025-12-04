import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { generateCodeVerifier, generateCodeChallenge, generateState, generateNonce } from '../lib/pkceHelper';
import { createPkceVerifierCookie } from '../lib/cookieHelper';
import { buildAuthorizationUrl } from '../lib/azureAdClient';
import { getConfig } from '../lib/config';

/**
 * LoginB2B - Initiates Azure AD B2B SSO login flow
 * 
 * Route: GET /api/auth/login/b2b
 * Query Params: redirect_uri (optional) - Where to redirect after login
 * Response: 302 Redirect to Azure AD authorization endpoint
 */
export async function LoginB2B(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log(`LoginB2B: Processing login request`);
  
  try {
    const config = getConfig();
    
    // Get redirect URI from query params (default to /dashboard)
    const redirectUri = request.query.get('redirect_uri') || '/dashboard';
    
    // 1. Generate PKCE code verifier (43-128 random chars)
    const codeVerifier = generateCodeVerifier();
    context.log(`LoginB2B: Generated PKCE verifier`);
    
    // 2. Create code challenge (SHA256 + base64url)
    const codeChallenge = await generateCodeChallenge(codeVerifier);
    context.log(`LoginB2B: Generated code challenge`);
    
    // 3. Generate state parameter (CSRF protection, includes encrypted redirect_uri)
    const state = generateState(redirectUri, config.tokens.jwtSecret);
    context.log(`LoginB2B: Generated state parameter`);
    
    // 4. Generate nonce (replay protection)
    const nonce = generateNonce();
    context.log(`LoginB2B: Generated nonce`);
    
    // 5. Build Azure AD authorization URL
    const authorizationUrl = await buildAuthorizationUrl(codeChallenge, state, nonce);
    context.log(`LoginB2B: Built authorization URL`);
    
    // 6. Create PKCE verifier cookie (stored for callback)
    const pkceVerifierCookie = createPkceVerifierCookie(codeVerifier);
    
    // 7. Redirect to Azure AD
    return {
      status: 302,
      headers: {
        'Location': authorizationUrl,
        'Cache-Control': 'no-store',
      },
      cookies: [pkceVerifierCookie],
    };
  } catch (error) {
    context.error(`LoginB2B: Error initiating login`, error);
    
    return {
      status: 500,
      jsonBody: {
        error: 'login_error',
        message: 'Failed to initiate login. Please try again.',
      },
    };
  }
}

app.http('LoginB2B', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'auth/login/b2b',
  handler: LoginB2B,
});
