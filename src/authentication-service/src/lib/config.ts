/**
 * Authentication Service Configuration
 */

export interface AuthenticationConfig {
  // Azure AD B2B
  azureAd: {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };

  // Token Settings
  tokens: {
    accessTokenLifetime: number;   // seconds
    refreshTokenLifetime: number;  // seconds
    jwtSecret: string;
    rotateRefreshToken: boolean;
  };

  // Cookie Settings
  cookies: {
    domain: string;
    secure: boolean;
    sameSite: 'strict' | 'lax' | 'none';
  };

  // Rate Limiting
  rateLimit: {
    maxLoginAttempts: number;
    lockoutDuration: number;       // seconds
  };

  // Internal
  internalServiceKey: string;

  // Cosmos DB
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    containers: {
      sessions: string;
      loginAttempts: string;
    };
  };

  // Event Grid
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
}

/**
 * Load configuration from environment variables
 */
export function loadConfig(): AuthenticationConfig {
  return {
    azureAd: {
      tenantId: process.env.AZURE_AD_TENANT_ID || '',
      clientId: process.env.AZURE_AD_CLIENT_ID || '',
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET || '',
      redirectUri: process.env.AUTH_REDIRECT_URI || 'http://localhost:7071/api/auth/callback/b2b',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
    },
    tokens: {
      accessTokenLifetime: 15 * 60, // 15 minutes
      refreshTokenLifetime: 30 * 24 * 60 * 60, // 30 days
      jwtSecret: process.env.JWT_SECRET || 'development-secret-change-in-production',
      rotateRefreshToken: true,
    },
    cookies: {
      domain: process.env.COOKIE_DOMAIN || 'localhost',
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: 'strict',
    },
    rateLimit: {
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60, // 15 minutes
    },
    internalServiceKey: process.env.INTERNAL_SERVICE_KEY || '',
    cosmos: {
      endpoint: process.env.COSMOS_ENDPOINT || '',
      key: process.env.COSMOS_KEY || '',
      databaseId: 'auth-db',
      containers: {
        sessions: 'sessions',
        loginAttempts: 'login-attempts',
      },
    },
    eventGrid: {
      topicEndpoint: process.env.EVENT_GRID_TOPIC_ENDPOINT || '',
      topicKey: process.env.EVENT_GRID_TOPIC_KEY || '',
    },
  };
}

// Export singleton config
let _config: AuthenticationConfig | null = null;

export function getConfig(): AuthenticationConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

