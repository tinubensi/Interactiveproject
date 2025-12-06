/**
 * Azure AD Client - MSAL integration for B2B authentication
 */

import {
  ConfidentialClientApplication,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
  Configuration,
} from '@azure/msal-node';
import { getConfig } from './config';

// MSAL client singleton
let _msalClient: ConfidentialClientApplication | null = null;

/**
 * Azure AD user info from ID token claims
 */
export interface AzureAdUserInfo {
  oid: string; // Azure AD object ID
  email: string;
  name: string;
  preferredUsername?: string;
  groups?: string[];
  tenantId: string;
}

/**
 * Token response from Azure AD
 */
export interface AzureAdTokenResponse {
  accessToken: string;
  idToken: string;
  account: {
    homeAccountId: string;
    tenantId: string;
    username: string;
    name?: string;
  };
  userInfo: AzureAdUserInfo;
}

/**
 * Initialize and get MSAL client
 */
function getMsalClient(): ConfidentialClientApplication {
  if (!_msalClient) {
    const config = getConfig();
    
    if (!config.azureAd.tenantId || !config.azureAd.clientId || !config.azureAd.clientSecret) {
      throw new Error('Azure AD configuration is incomplete');
    }
    
    const msalConfig: Configuration = {
      auth: {
        clientId: config.azureAd.clientId,
        authority: `https://login.microsoftonline.com/${config.azureAd.tenantId}`,
        clientSecret: config.azureAd.clientSecret,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message) => {
            console.log(`[MSAL] ${message}`);
          },
          piiLoggingEnabled: false,
          logLevel: 3, // Warning
        },
      },
    };
    
    _msalClient = new ConfidentialClientApplication(msalConfig);
  }
  
  return _msalClient;
}

/**
 * Build authorization URL for B2B login
 */
export async function buildAuthorizationUrl(
  codeChallenge: string,
  state: string,
  nonce: string
): Promise<string> {
  const config = getConfig();
  const msalClient = getMsalClient();
  
  const authCodeUrlParams: AuthorizationUrlRequest = {
    scopes: config.azureAd.scopes,
    redirectUri: config.azureAd.redirectUri,
    codeChallenge,
    codeChallengeMethod: 'S256',
    state,
    nonce,
    prompt: 'select_account',
  };
  
  const authUrl = await msalClient.getAuthCodeUrl(authCodeUrlParams);
  return authUrl;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<AzureAdTokenResponse> {
  const config = getConfig();
  const msalClient = getMsalClient();
  
  const tokenRequest: AuthorizationCodeRequest = {
    code,
    scopes: config.azureAd.scopes,
    redirectUri: config.azureAd.redirectUri,
    codeVerifier,
  };
  
  const response = await msalClient.acquireTokenByCode(tokenRequest);
  
  if (!response) {
    throw new Error('Failed to acquire token');
  }
  
  // Extract user info from ID token claims
  const idTokenClaims = response.idTokenClaims as Record<string, unknown>;
  
  const userInfo: AzureAdUserInfo = {
    oid: idTokenClaims.oid as string,
    email: (idTokenClaims.email || idTokenClaims.preferred_username || response.account?.username) as string,
    name: (idTokenClaims.name || response.account?.name || 'Unknown') as string,
    preferredUsername: idTokenClaims.preferred_username as string | undefined,
    groups: idTokenClaims.groups as string[] | undefined,
    tenantId: response.account?.tenantId || '',
  };
  
  return {
    accessToken: response.accessToken,
    idToken: response.idToken || '',
    account: {
      homeAccountId: response.account?.homeAccountId || '',
      tenantId: response.account?.tenantId || '',
      username: response.account?.username || '',
      name: response.account?.name,
    },
    userInfo,
  };
}

/**
 * Build Azure AD logout URL
 */
export function buildLogoutUrl(postLogoutRedirectUri?: string): string {
  const config = getConfig();
  
  const baseUrl = `https://login.microsoftonline.com/${config.azureAd.tenantId}/oauth2/v2.0/logout`;
  
  if (postLogoutRedirectUri) {
    return `${baseUrl}?post_logout_redirect_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
  }
  
  return baseUrl;
}

/**
 * Map Azure AD groups to application roles
 */
export function mapGroupsToRoles(groups: string[]): string[] {
  const groupToRoleMap: Record<string, string> = {
    'Nectaria-SuperAdmins': 'super-admin',
    'Nectaria-ComplianceOfficers': 'compliance-officer',
    'Nectaria-BrokerManagers': 'broker-manager',
    'Nectaria-SeniorBrokers': 'senior-broker',
    'Nectaria-JuniorBrokers': 'junior-broker',
    'Nectaria-Underwriters': 'underwriter',
    'Nectaria-CustomerSupport': 'customer-support',
  };
  
  const roles: string[] = [];
  
  for (const group of groups) {
    const role = groupToRoleMap[group];
    if (role) {
      roles.push(role);
    }
  }
  
  // If no roles mapped, assign a default role
  if (roles.length === 0) {
    roles.push('junior-broker');
  }
  
  return roles;
}

/**
 * Validate that user belongs to allowed tenant
 */
export function validateTenant(tenantId: string): boolean {
  const config = getConfig();
  
  // In B2B, users must be from the configured tenant
  return tenantId === config.azureAd.tenantId;
}

