# Authentication Service Requirements

## Overview

The Authentication Service handles user identity verification, session management, and token lifecycle. It is the single entry point for all authentication flows using **Azure AD B2B** for internal staff/brokers and **Azure AD B2C** for external customers (Phase 2).

### Service Identity

| Property | Value |
|----------|-------|
| **Service Name** | `authentication-service` |
| **Runtime** | Azure Functions (Node.js 20, TypeScript) |
| **Database** | Azure Cosmos DB (`auth-db`) |
| **Identity Provider** | Azure AD B2B (Phase 1), Azure AD B2C (Phase 2) |
| **Event Bus** | Azure Event Grid |
| **Development Duration** | 1 day |

---

## Table of Contents

1. [Scope](#1-scope)
2. [Functional Requirements](#2-functional-requirements)
3. [API Specifications](#3-api-specifications)
4. [Database Schema](#4-database-schema)
5. [Events](#5-events)
6. [Configuration](#6-configuration)
7. [Security](#7-security)
8. [Test Cases](#8-test-cases)
9. [File Structure](#9-file-structure)
10. [Dependencies](#10-dependencies)

---

## 1. Scope

### In Scope

| Feature | Description |
|---------|-------------|
| B2B SSO | Azure AD Single Sign-On for staff |
| B2C Authentication | Email + Password + OTP for customers (Phase 2) |
| Token Issuance | Access tokens (15 min) + Refresh tokens (30 days) |
| Token Refresh | Refresh access tokens with rotation |
| Token Introspection | Validate tokens for other services |
| Session Management | Create, list, invalidate sessions |
| Logout | Single session and all sessions |
| Cookie Handling | httpOnly, Secure, SameSite cookies |

### Out of Scope

| Feature | Responsible Service |
|---------|---------------------|
| Role/Permission management | Authorization Service |
| Audit logging storage | Audit Service |
| Staff data management | Staff Management Service |

---

## 2. Functional Requirements

### FR-AUTH-001: B2B Single Sign-On (SSO)

**Priority**: P1 (Must Have) - Phase 1

```
As a broker/staff member,
I want to log in using my corporate Microsoft account,
So that I can access the admin dashboard without creating a separate password.
```

**Acceptance Criteria**:
- [ ] Staff can initiate login via Microsoft SSO button
- [ ] System redirects to Azure AD B2B tenant login page
- [ ] Upon successful authentication, user is redirected back with authorization code
- [ ] System exchanges authorization code for tokens (access + refresh)
- [ ] Tokens are stored in `httpOnly` secure cookies
- [ ] User identity (email, name, groups) is extracted from ID token
- [ ] `UserLoggedInEvent` is published to Event Grid
- [ ] Login attempt is logged (success/failure)

### FR-AUTH-002: B2C Email + OTP Login (Phase 2)

**Priority**: P2 (Should Have) - Phase 2

```
As a registered customer,
I want to log in using email and OTP,
So that I can access my account securely.
```

**Acceptance Criteria**:
- [ ] Customer enters email address
- [ ] If customer exists, OTP is sent to email
- [ ] OTP is valid for 5 minutes
- [ ] OTP is 6 digits
- [ ] After 3 failed OTP attempts, account is temporarily locked (15 minutes)
- [ ] Successful OTP verification issues tokens in `httpOnly` cookies
- [ ] `UserLoggedInEvent` is published to Event Grid

### FR-AUTH-003: Token Refresh

**Priority**: P1 (Must Have) - Phase 1

```
As a logged-in user,
I want my session to stay active while I'm using the application,
So that I don't have to log in repeatedly.
```

**Acceptance Criteria**:
- [ ] Access token expires after 15 minutes
- [ ] Refresh token expires after 30 days
- [ ] Sliding session: refresh token expiry extends on use
- [ ] Frontend automatically refreshes access token before expiry
- [ ] Refresh token rotation: new refresh token issued on each refresh
- [ ] Old refresh tokens are invalidated after rotation
- [ ] Reused refresh tokens trigger session invalidation (attack detection)

### FR-AUTH-004: Logout

**Priority**: P1 (Must Have) - Phase 1

```
As a logged-in user,
I want to log out of the system,
So that my session is terminated and my account is secure.
```

**Acceptance Criteria**:
- [ ] User can trigger logout from the UI
- [ ] Access token cookie is cleared
- [ ] Refresh token cookie is cleared
- [ ] Session is invalidated in the database
- [ ] User is redirected to login page
- [ ] `UserLoggedOutEvent` is published to Event Grid
- [ ] For B2B: optional Azure AD sign-out URL provided

### FR-AUTH-005: Token Introspection

**Priority**: P1 (Must Have) - Phase 1

```
As a backend service,
I want to validate JWT tokens,
So that I can authenticate incoming API requests.
```

**Acceptance Criteria**:
- [ ] All backend services call authentication-service to validate tokens
- [ ] Validation checks: signature, expiry, issuer, audience
- [ ] Validation returns user ID, email, and Azure AD groups
- [ ] Invalid tokens return `{ active: false }`
- [ ] Validation response is cacheable (5 minutes)
- [ ] High-performance: < 50ms response time (p95)
- [ ] Requires internal service key for access

### FR-AUTH-006: Session Management

**Priority**: P1 (Must Have) - Phase 1

```
As a user,
I want to see my active sessions and log out from specific devices,
So that I can manage my account security.
```

**Acceptance Criteria**:
- [ ] User can list all active sessions
- [ ] Session info includes: device, IP, last activity, created time
- [ ] User can logout from a specific session
- [ ] User can logout from all sessions except current
- [ ] Session invalidation clears associated tokens

---

## 3. API Specifications

### 3.1 Public Endpoints

#### `GET /api/auth/login/b2b`

Initiates B2B SSO login flow.

**Request**:
```http
GET /api/auth/login/b2b?redirect_uri=/dashboard
```

**Response**:
```http
HTTP/1.1 302 Found
Location: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/authorize?
  client_id={client_id}&
  response_type=code&
  redirect_uri={redirect_uri}&
  scope=openid%20profile%20email%20offline_access&
  state={csrf_state}&
  nonce={nonce}&
  code_challenge={pkce_challenge}&
  code_challenge_method=S256
```

---

#### `GET /api/auth/callback/b2b`

Handles OAuth callback from Azure AD B2B.

**Request**:
```http
GET /api/auth/callback/b2b?code={authorization_code}&state={state}
```

**Response (Success)**:
```http
HTTP/1.1 302 Found
Location: /dashboard
Set-Cookie: nectaria_access_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=900; Path=/
Set-Cookie: nectaria_refresh_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000; Path=/api/auth/refresh
```

**Response (Error)**:
```http
HTTP/1.1 302 Found
Location: /login?error=access_denied&error_description=User%20cancelled%20login
```

---

#### `POST /api/auth/login/b2c` (Phase 2)

Initiates B2C email + OTP login flow.

**Request**:
```json
POST /api/auth/login/b2c
Content-Type: application/json

{
  "email": "customer@example.com"
}
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "message": "OTP sent to your email",
  "otpSentAt": "2025-12-03T10:00:00Z",
  "expiresIn": 300
}
```

**Error Response (User Not Found)**:
```json
HTTP/1.1 404 Not Found

{
  "error": "user_not_found",
  "message": "No account found with this email"
}
```

---

#### `POST /api/auth/verify-otp` (Phase 2)

Verifies OTP and issues tokens.

**Request**:
```json
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "customer@example.com",
  "otp": "123456"
}
```

**Response (Success)**:
```http
HTTP/1.1 200 OK
Set-Cookie: nectaria_access_token=eyJ...; HttpOnly; Secure; SameSite=Strict
Set-Cookie: nectaria_refresh_token=eyJ...; HttpOnly; Secure; SameSite=Strict

{
  "user": {
    "id": "user-uuid",
    "email": "customer@example.com",
    "name": "John Doe"
  }
}
```

**Error Response (Invalid OTP)**:
```json
HTTP/1.1 401 Unauthorized

{
  "error": "invalid_otp",
  "message": "Invalid or expired OTP",
  "attemptsRemaining": 2
}
```

---

#### `POST /api/auth/refresh`

Refreshes access token using refresh token.

**Request**:
```http
POST /api/auth/refresh
Cookie: nectaria_refresh_token=eyJ...
```

**Response (Success)**:
```http
HTTP/1.1 200 OK
Set-Cookie: nectaria_access_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=900
Set-Cookie: nectaria_refresh_token=eyJ...; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000

{
  "expiresIn": 900,
  "tokenType": "Bearer"
}
```

**Error Response (Invalid Token)**:
```json
HTTP/1.1 401 Unauthorized

{
  "error": "invalid_refresh_token",
  "message": "Refresh token is invalid or expired"
}
```

---

#### `POST /api/auth/logout`

Logs out the current session.

**Request**:
```http
POST /api/auth/logout
Cookie: nectaria_access_token=eyJ...
```

**Response**:
```http
HTTP/1.1 200 OK
Set-Cookie: nectaria_access_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0
Set-Cookie: nectaria_refresh_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/api/auth/refresh

{
  "message": "Logged out successfully",
  "azureLogoutUrl": "https://login.microsoftonline.com/{tenant}/oauth2/v2.0/logout?post_logout_redirect_uri=..."
}
```

---

#### `POST /api/auth/logout/all`

Logs out all sessions for the user.

**Request**:
```http
POST /api/auth/logout/all
Cookie: nectaria_access_token=eyJ...
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "message": "Logged out from all devices",
  "sessionsInvalidated": 3
}
```

---

#### `GET /api/auth/me`

Returns current user information.

**Request**:
```http
GET /api/auth/me
Cookie: nectaria_access_token=eyJ...
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "id": "user-uuid",
  "email": "broker@company.com",
  "name": "Jane Smith",
  "azureAdGroups": ["Nectaria-SeniorBrokers", "Nectaria-TeamDubai"],
  "authMethod": "b2b_sso",
  "sessionId": "session-uuid",
  "lastLogin": "2025-12-03T10:00:00Z"
}
```

---

#### `GET /api/auth/sessions`

Lists all active sessions for the current user.

**Request**:
```http
GET /api/auth/sessions
Cookie: nectaria_access_token=eyJ...
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "sessions": [
    {
      "id": "session-1-uuid",
      "deviceInfo": "Chrome on Windows",
      "ipAddress": "203.0.113.42",
      "createdAt": "2025-12-03T08:00:00Z",
      "lastActivityAt": "2025-12-03T10:30:00Z",
      "isCurrent": true
    },
    {
      "id": "session-2-uuid",
      "deviceInfo": "Safari on iPhone",
      "ipAddress": "203.0.113.50",
      "createdAt": "2025-12-02T14:00:00Z",
      "lastActivityAt": "2025-12-02T18:00:00Z",
      "isCurrent": false
    }
  ]
}
```

---

#### `DELETE /api/auth/sessions/{sessionId}`

Invalidates a specific session.

**Request**:
```http
DELETE /api/auth/sessions/session-2-uuid
Cookie: nectaria_access_token=eyJ...
```

**Response**:
```json
HTTP/1.1 200 OK

{
  "message": "Session invalidated"
}
```

---

### 3.2 Internal Endpoints (Service-to-Service)

#### `POST /api/auth/introspect`

Validates and introspects a token. Used by other backend services.

**Request**:
```json
POST /api/auth/introspect
Content-Type: application/json
X-Service-Key: {internal-service-key}

{
  "token": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response (Active Token)**:
```json
HTTP/1.1 200 OK

{
  "active": true,
  "userId": "user-uuid",
  "email": "broker@company.com",
  "name": "Jane Smith",
  "azureAdGroups": ["Nectaria-SeniorBrokers"],
  "authMethod": "b2b_sso",
  "sessionId": "session-uuid",
  "iat": 1701600000,
  "exp": 1701600900,
  "iss": "https://login.microsoftonline.com/{tenant}/v2.0",
  "aud": "api://{client-id}"
}
```

**Response (Inactive/Expired Token)**:
```json
HTTP/1.1 200 OK

{
  "active": false,
  "reason": "token_expired"
}
```

---

## 4. Database Schema

**Database**: `auth-db`

### Container: `sessions`

**Partition Key**: `/userId`

```typescript
interface Session {
  id: string;                    // Session UUID
  userId: string;                // Partition key
  email: string;
  name: string;
  
  // Authentication
  authMethod: 'b2b_sso' | 'b2c_password' | 'b2c_otp';
  azureAdGroups: string[];       // From ID token
  
  // Tokens (hashed for security)
  accessTokenHash: string;       // SHA-256 hash
  refreshTokenHash: string;      // SHA-256 hash
  refreshTokenFamily: string;    // For rotation detection
  
  // Context
  ipAddress: string;
  userAgent: string;
  deviceInfo: string;            // Parsed from user agent
  
  // Timestamps
  createdAt: string;             // ISO 8601
  expiresAt: string;             // ISO 8601
  lastActivityAt: string;        // ISO 8601
  
  // Cosmos DB
  ttl: number;                   // 30 days (2592000 seconds)
  _ts: number;
}
```

**Indexes**:
- Composite: `[userId ASC, expiresAt DESC]` - Active sessions query
- Single: `refreshTokenHash` - Token lookup

---

### Container: `otps` (Phase 2)

**Partition Key**: `/email`

```typescript
interface OTP {
  id: string;                    // UUID
  email: string;                 // Partition key
  otpHash: string;               // SHA-256 hashed OTP
  purpose: 'login' | 'registration' | 'password_reset' | 'email_verify';
  attempts: number;              // Failed attempts count
  maxAttempts: number;           // Default: 3
  createdAt: string;             // ISO 8601
  expiresAt: string;             // ISO 8601
  ttl: number;                   // 300 seconds (5 min)
}
```

---

### Container: `login-attempts`

**Partition Key**: `/email`

```typescript
interface LoginAttempt {
  id: string;                    // UUID
  email: string;                 // Partition key
  attempts: number;              // Failed attempt count
  lastAttemptAt: string;         // ISO 8601
  lockedUntil?: string;          // ISO 8601 (if locked)
  ttl: number;                   // 900 seconds (15 min)
}
```

---

## 5. Events

### Events Published

| Event Type | Description | Payload |
|------------|-------------|---------|
| `auth.user.logged_in` | User successfully logged in | See schema below |
| `auth.user.logged_out` | User logged out | See schema below |
| `auth.login.failed` | Login attempt failed | See schema below |
| `auth.session.created` | New session created | See schema below |
| `auth.session.expired` | Session timed out | See schema below |
| `auth.token.refreshed` | Token was refreshed | See schema below |

### Event Schemas

#### `auth.user.logged_in`
```json
{
  "eventType": "auth.user.logged_in",
  "eventTime": "2025-12-03T10:00:00Z",
  "id": "event-uuid",
  "subject": "/users/{userId}",
  "data": {
    "userId": "user-uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "authMethod": "b2b_sso",
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "sessionId": "session-uuid",
    "azureAdGroups": ["Nectaria-SeniorBrokers"],
    "loginTime": "2025-12-03T10:00:00Z"
  },
  "dataVersion": "1.0"
}
```

#### `auth.login.failed`
```json
{
  "eventType": "auth.login.failed",
  "eventTime": "2025-12-03T10:00:00Z",
  "id": "event-uuid",
  "subject": "/auth/login",
  "data": {
    "email": "user@example.com",
    "reason": "invalid_credentials",
    "ipAddress": "203.0.113.42",
    "userAgent": "Mozilla/5.0...",
    "attemptNumber": 3,
    "lockoutTriggered": false
  },
  "dataVersion": "1.0"
}
```

#### `auth.user.logged_out`
```json
{
  "eventType": "auth.user.logged_out",
  "eventTime": "2025-12-03T10:00:00Z",
  "id": "event-uuid",
  "subject": "/users/{userId}",
  "data": {
    "userId": "user-uuid",
    "email": "user@example.com",
    "sessionId": "session-uuid",
    "logoutType": "user_initiated",
    "sessionsInvalidated": 1
  },
  "dataVersion": "1.0"
}
```

---

## 6. Configuration

```typescript
interface AuthenticationConfig {
  // Azure AD B2B
  azureAd: {
    tenantId: string;
    clientId: string;
    clientSecret: string;        // From Key Vault
    redirectUri: string;
    scopes: string[];            // ['openid', 'profile', 'email', 'offline_access']
  };
  
  // Azure AD B2C (Phase 2)
  azureAdB2C?: {
    tenant: string;
    clientId: string;
    clientSecret: string;
    userFlow: string;
    redirectUri: string;
  };
  
  // Token Settings
  tokens: {
    accessTokenLifetime: number;   // 900 (15 minutes)
    refreshTokenLifetime: number;  // 2592000 (30 days)
    rotateRefreshToken: boolean;   // true
  };
  
  // Cookie Settings
  cookies: {
    domain: string;                // '.nectaria.com' or 'localhost'
    secure: boolean;               // true in production
    sameSite: 'strict' | 'lax';    // 'strict'
    httpOnly: boolean;             // true (always)
  };
  
  // Security
  security: {
    maxLoginAttempts: number;      // 5
    lockoutDuration: number;       // 900 (15 minutes)
    enablePKCE: boolean;           // true
  };
  
  // Internal Service Authentication
  internalServiceKey: string;      // From Key Vault
  
  // Cosmos DB
  cosmosDb: {
    endpoint: string;
    databaseName: string;          // 'auth-db'
    containers: {
      sessions: string;            // 'sessions'
      otps: string;                // 'otps'
      loginAttempts: string;       // 'login-attempts'
    };
  };
  
  // Event Grid
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;              // From Key Vault
  };
}
```

### Environment Variables

```bash
# Azure AD B2B
AZURE_AD_TENANT_ID=
AZURE_AD_CLIENT_ID=
AZURE_AD_CLIENT_SECRET=           # From Key Vault reference

# Azure AD B2C (Phase 2)
AZURE_AD_B2C_TENANT=
AZURE_AD_B2C_CLIENT_ID=
AZURE_AD_B2C_CLIENT_SECRET=
AZURE_AD_B2C_USER_FLOW=

# Cosmos DB
COSMOS_DB_ENDPOINT=
COSMOS_DB_KEY=                    # Or use Managed Identity

# Event Grid
EVENT_GRID_TOPIC_ENDPOINT=
EVENT_GRID_TOPIC_KEY=

# Security
INTERNAL_SERVICE_KEY=             # From Key Vault reference

# Environment
NODE_ENV=production
COOKIE_DOMAIN=.nectaria.com
```

---

## 7. Security

### 7.1 Token Security

| Aspect | Implementation |
|--------|----------------|
| Token Storage | httpOnly, Secure, SameSite=Strict cookies |
| Token Signing | Azure AD uses RS256 (asymmetric) |
| Token Validation | Verify signature, issuer, audience, expiry |
| Refresh Token Rotation | New refresh token on each use |
| Rotation Attack Detection | Invalidate all sessions on reuse |

### 7.2 Authentication Security

| Aspect | Implementation |
|--------|----------------|
| PKCE | Required for authorization code flow |
| State Parameter | CSRF protection on callbacks |
| Nonce | Replay attack prevention |
| Brute Force | 5 failed attempts → 15 min lockout |
| OTP Security | 6 digits, 5 min expiry, 3 max attempts |

### 7.3 Cookie Configuration

```typescript
const cookieOptions = {
  httpOnly: true,           // Not accessible via JavaScript (XSS protection)
  secure: true,             // HTTPS only
  sameSite: 'strict',       // CSRF protection
  path: '/',
  domain: '.nectaria.com',
};

const accessTokenCookie = {
  ...cookieOptions,
  name: 'nectaria_access_token',
  maxAge: 15 * 60,          // 15 minutes
};

const refreshTokenCookie = {
  ...cookieOptions,
  name: 'nectaria_refresh_token',
  maxAge: 30 * 24 * 60 * 60, // 30 days
  path: '/api/auth/refresh', // Only sent to refresh endpoint
};
```

### 7.4 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login/*` | 10 requests | per minute per IP |
| `/api/auth/verify-otp` | 5 requests | per minute per email |
| `/api/auth/refresh` | 30 requests | per minute per user |
| `/api/auth/introspect` | 1000 requests | per minute per service |

---

## 8. Test Cases

```typescript
// File: src/tests/authentication.test.ts

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';

describe('AuthenticationService', () => {
  
  describe('B2B SSO Login', () => {
    it('should redirect to Azure AD authorization endpoint', async () => {
      const request = createMockRequest({ path: '/api/auth/login/b2b' });
      const response = await loginB2B(request, mockContext);
      
      assert.strictEqual(response.status, 302);
      assert.ok(response.headers.get('Location')?.includes('login.microsoftonline.com'));
    });

    it('should include PKCE challenge in authorization request', async () => {
      const response = await loginB2B(createMockRequest(), mockContext);
      const location = new URL(response.headers.get('Location')!);
      
      assert.ok(location.searchParams.has('code_challenge'));
      assert.strictEqual(location.searchParams.get('code_challenge_method'), 'S256');
    });

    it('should include required OAuth parameters', async () => {
      const response = await loginB2B(createMockRequest(), mockContext);
      const location = new URL(response.headers.get('Location')!);
      
      assert.strictEqual(location.searchParams.get('response_type'), 'code');
      assert.ok(location.searchParams.has('state'));
      assert.ok(location.searchParams.has('nonce'));
    });

    it('should store PKCE verifier in session for callback', async () => {
      // Implementation test
    });
  });

  describe('B2B Callback', () => {
    it('should exchange authorization code for tokens', async () => {
      mock.method(azureAdClient, 'exchangeCode', () => Promise.resolve(mockTokenResponse));
      
      const request = createMockRequest({
        query: { code: 'auth-code', state: 'valid-state' },
      });
      const response = await callbackB2B(request, mockContext);
      
      assert.strictEqual(response.status, 302);
    });

    it('should set httpOnly cookies for tokens', async () => {
      const response = await callbackB2B(validRequest, mockContext);
      const cookies = response.headers.getSetCookie();
      
      const accessCookie = cookies.find(c => c.includes('nectaria_access_token'));
      assert.ok(accessCookie?.includes('HttpOnly'));
      assert.ok(accessCookie?.includes('Secure'));
      assert.ok(accessCookie?.includes('SameSite=Strict'));
    });

    it('should create session in database', async () => {
      await callbackB2B(validRequest, mockContext);
      
      const session = await sessionRepository.findByUserId(mockUserId);
      assert.ok(session);
      assert.strictEqual(session.email, mockEmail);
    });

    it('should extract Azure AD groups from ID token', async () => {
      const tokenWithGroups = {
        ...mockTokenResponse,
        id_token_claims: {
          groups: ['Nectaria-SeniorBrokers'],
        },
      };
      mock.method(azureAdClient, 'exchangeCode', () => Promise.resolve(tokenWithGroups));
      
      await callbackB2B(validRequest, mockContext);
      
      const session = await sessionRepository.findByUserId(mockUserId);
      assert.deepStrictEqual(session.azureAdGroups, ['Nectaria-SeniorBrokers']);
    });

    it('should publish UserLoggedInEvent', async () => {
      const publishEvent = mock.fn();
      mock.method(eventGridService, 'publish', publishEvent);
      
      await callbackB2B(validRequest, mockContext);
      
      assert.strictEqual(publishEvent.mock.calls.length, 1);
      assert.strictEqual(publishEvent.mock.calls[0].arguments[0].eventType, 'auth.user.logged_in');
    });

    it('should reject invalid state (CSRF protection)', async () => {
      const request = createMockRequest({
        query: { code: 'auth-code', state: 'invalid-state' },
      });
      
      const response = await callbackB2B(request, mockContext);
      
      assert.strictEqual(response.status, 302);
      assert.ok(response.headers.get('Location')?.includes('error=invalid_state'));
    });

    it('should handle Azure AD errors gracefully', async () => {
      const request = createMockRequest({
        query: { error: 'access_denied', error_description: 'User cancelled' },
      });
      
      const response = await callbackB2B(request, mockContext);
      
      assert.strictEqual(response.status, 302);
      assert.ok(response.headers.get('Location')?.includes('error=access_denied'));
    });
  });

  describe('Token Refresh', () => {
    it('should refresh access token with valid refresh token', async () => {
      const request = createMockRequest({
        cookies: { nectaria_refresh_token: validRefreshToken },
      });
      
      const response = await refreshToken(request, mockContext);
      
      assert.strictEqual(response.status, 200);
      assert.ok(response.headers.getSetCookie().some(c => c.includes('nectaria_access_token')));
    });

    it('should rotate refresh token on each refresh', async () => {
      const response = await refreshToken(validRequest, mockContext);
      const cookies = response.headers.getSetCookie();
      
      const newRefreshCookie = cookies.find(c => c.includes('nectaria_refresh_token'));
      assert.ok(newRefreshCookie);
      // New token should be different
    });

    it('should reject expired refresh tokens', async () => {
      const request = createMockRequest({
        cookies: { nectaria_refresh_token: expiredRefreshToken },
      });
      
      const response = await refreshToken(request, mockContext);
      
      assert.strictEqual(response.status, 401);
    });

    it('should detect and reject reused refresh tokens', async () => {
      // Use a token that was already rotated
      const request = createMockRequest({
        cookies: { nectaria_refresh_token: previouslyRotatedToken },
      });
      
      const response = await refreshToken(request, mockContext);
      
      assert.strictEqual(response.status, 401);
    });

    it('should invalidate all sessions on rotation attack', async () => {
      await refreshToken(reusedTokenRequest, mockContext);
      
      const sessions = await sessionRepository.findAllByUserId(mockUserId);
      assert.strictEqual(sessions.length, 0);
    });
  });

  describe('Logout', () => {
    it('should clear access token cookie', async () => {
      const response = await logout(validRequest, mockContext);
      const cookies = response.headers.getSetCookie();
      
      const accessCookie = cookies.find(c => c.includes('nectaria_access_token'));
      assert.ok(accessCookie?.includes('Max-Age=0'));
    });

    it('should clear refresh token cookie', async () => {
      const response = await logout(validRequest, mockContext);
      const cookies = response.headers.getSetCookie();
      
      const refreshCookie = cookies.find(c => c.includes('nectaria_refresh_token'));
      assert.ok(refreshCookie?.includes('Max-Age=0'));
    });

    it('should invalidate session in database', async () => {
      await logout(validRequest, mockContext);
      
      const session = await sessionRepository.findById(mockSessionId);
      assert.strictEqual(session, null);
    });

    it('should publish UserLoggedOutEvent', async () => {
      const publishEvent = mock.fn();
      mock.method(eventGridService, 'publish', publishEvent);
      
      await logout(validRequest, mockContext);
      
      assert.strictEqual(publishEvent.mock.calls[0].arguments[0].eventType, 'auth.user.logged_out');
    });

    it('should return Azure AD logout URL for B2B users', async () => {
      const response = await logout(b2bUserRequest, mockContext);
      const body = await response.json();
      
      assert.ok(body.azureLogoutUrl?.includes('login.microsoftonline.com'));
    });
  });

  describe('Logout All', () => {
    it('should invalidate all sessions for user', async () => {
      // Create multiple sessions
      await sessionRepository.create({ userId: mockUserId, device: 'device1' });
      await sessionRepository.create({ userId: mockUserId, device: 'device2' });
      
      await logoutAll(validRequest, mockContext);
      
      const sessions = await sessionRepository.findAllByUserId(mockUserId);
      assert.strictEqual(sessions.length, 0);
    });

    it('should return count of invalidated sessions', async () => {
      const response = await logoutAll(validRequest, mockContext);
      const body = await response.json();
      
      assert.ok(body.sessionsInvalidated >= 1);
    });
  });

  describe('Token Introspection', () => {
    it('should return active=true for valid token', async () => {
      const request = createMockRequest({
        body: { token: validAccessToken },
        headers: { 'X-Service-Key': internalServiceKey },
      });
      
      const response = await introspect(request, mockContext);
      const body = await response.json();
      
      assert.strictEqual(response.status, 200);
      assert.strictEqual(body.active, true);
      assert.ok(body.userId);
      assert.ok(body.email);
      assert.ok(body.azureAdGroups);
    });

    it('should return active=false for expired token', async () => {
      const request = createMockRequest({
        body: { token: expiredAccessToken },
        headers: { 'X-Service-Key': internalServiceKey },
      });
      
      const response = await introspect(request, mockContext);
      const body = await response.json();
      
      assert.strictEqual(body.active, false);
      assert.strictEqual(body.reason, 'token_expired');
    });

    it('should reject requests without service key', async () => {
      const request = createMockRequest({
        body: { token: validAccessToken },
      });
      
      const response = await introspect(request, mockContext);
      
      assert.strictEqual(response.status, 401);
    });

    it('should cache introspection results', async () => {
      const cacheSet = mock.fn();
      mock.method(cache, 'set', cacheSet);
      
      await introspect(validRequest, mockContext);
      
      assert.strictEqual(cacheSet.mock.calls.length, 1);
    });

    it('should respond within 50ms (p95)', async () => {
      const start = Date.now();
      await introspect(validRequest, mockContext);
      const duration = Date.now() - start;
      
      assert.ok(duration < 50, `Response took ${duration}ms, expected < 50ms`);
    });
  });

  describe('Session Management', () => {
    it('should list all active sessions for user', async () => {
      const response = await getSessions(validRequest, mockContext);
      const body = await response.json();
      
      assert.ok(Array.isArray(body.sessions));
      assert.ok(body.sessions.length >= 1);
    });

    it('should mark current session in list', async () => {
      const response = await getSessions(validRequest, mockContext);
      const body = await response.json();
      
      const currentSession = body.sessions.find((s: any) => s.isCurrent);
      assert.ok(currentSession);
    });

    it('should delete specific session', async () => {
      const response = await deleteSession(deleteSessionRequest, mockContext);
      
      assert.strictEqual(response.status, 200);
    });

    it('should prevent deleting current session via this endpoint', async () => {
      const response = await deleteSession(deleteCurrentSessionRequest, mockContext);
      
      assert.strictEqual(response.status, 400);
    });
  });

  describe('Brute Force Protection', () => {
    it('should track failed login attempts', async () => {
      await loginB2C({ email: 'test@example.com', otp: 'wrong' }, mockContext);
      
      const attempts = await loginAttemptRepository.get('test@example.com');
      assert.strictEqual(attempts.attempts, 1);
    });

    it('should lock account after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await loginB2C({ email: 'test@example.com', otp: 'wrong' }, mockContext);
      }
      
      const attempts = await loginAttemptRepository.get('test@example.com');
      assert.ok(attempts.lockedUntil);
    });

    it('should reject login during lockout', async () => {
      // After lockout
      const response = await loginB2C({ email: 'test@example.com', otp: '123456' }, mockContext);
      
      assert.strictEqual(response.status, 429);
    });

    it('should reset attempts after successful login', async () => {
      await loginB2C(validCredentials, mockContext);
      
      const attempts = await loginAttemptRepository.get('test@example.com');
      assert.strictEqual(attempts, null);
    });
  });
});
```

---

## 9. File Structure

```
authentication-service/
├── src/
│   ├── functions/
│   │   ├── LoginB2B.ts              # GET /api/auth/login/b2b
│   │   ├── CallbackB2B.ts           # GET /api/auth/callback/b2b
│   │   ├── LoginB2C.ts              # POST /api/auth/login/b2c (Phase 2)
│   │   ├── VerifyOtp.ts             # POST /api/auth/verify-otp (Phase 2)
│   │   ├── RefreshToken.ts          # POST /api/auth/refresh
│   │   ├── Logout.ts                # POST /api/auth/logout
│   │   ├── LogoutAll.ts             # POST /api/auth/logout/all
│   │   ├── GetMe.ts                 # GET /api/auth/me
│   │   ├── GetSessions.ts           # GET /api/auth/sessions
│   │   ├── DeleteSession.ts         # DELETE /api/auth/sessions/{id}
│   │   └── Introspect.ts            # POST /api/auth/introspect
│   ├── lib/
│   │   ├── azureAdClient.ts         # Azure AD B2B client
│   │   ├── azureAdB2CClient.ts      # Azure AD B2C client (Phase 2)
│   │   ├── tokenService.ts          # Token generation/validation
│   │   ├── sessionService.ts        # Session CRUD
│   │   ├── otpService.ts            # OTP generation/validation (Phase 2)
│   │   ├── cookieHelper.ts          # Cookie utilities
│   │   ├── bruteForceProtection.ts  # Login attempt tracking
│   │   ├── eventPublisher.ts        # Event Grid publisher
│   │   ├── config.ts                # Configuration loader
│   │   └── cosmosClient.ts          # Cosmos DB client
│   ├── models/
│   │   ├── Session.ts
│   │   ├── OTP.ts
│   │   └── LoginAttempt.ts
│   ├── middleware/
│   │   └── requireAuth.ts           # Auth middleware
│   └── tests/
│       ├── loginB2B.test.ts
│       ├── callback.test.ts
│       ├── tokenRefresh.test.ts
│       ├── logout.test.ts
│       ├── introspect.test.ts
│       ├── sessionService.test.ts
│       └── bruteForce.test.ts
├── host.json
├── local.settings.json
├── package.json
├── tsconfig.json
└── REQUIREMENTS.md
```

---

## 10. Dependencies

### NPM Packages

```json
{
  "dependencies": {
    "@azure/cosmos": "^4.0.0",
    "@azure/functions": "^4.0.0",
    "@azure/identity": "^4.0.0",
    "@azure/keyvault-secrets": "^4.0.0",
    "@azure/event-grid": "^5.0.0",
    "jsonwebtoken": "^9.0.0",
    "jwks-rsa": "^3.0.0",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/jsonwebtoken": "^9.0.0",
    "typescript": "^5.0.0",
    "azure-functions-core-tools": "^4.0.0"
  }
}
```

### Azure Resources

| Resource | Purpose |
|----------|---------|
| Azure AD B2B Tenant | Staff SSO |
| Azure AD B2C Tenant | Customer auth (Phase 2) |
| Azure Key Vault | Store secrets |
| Azure Cosmos DB | Session storage |
| Azure Event Grid | Publish events |
| Azure Functions | Compute |

---

## Appendix A: Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_credentials` | 401 | Email or password incorrect |
| `invalid_otp` | 401 | OTP incorrect or expired |
| `invalid_refresh_token` | 401 | Refresh token invalid or expired |
| `invalid_state` | 400 | CSRF state mismatch |
| `user_not_found` | 404 | No account with this email |
| `account_locked` | 429 | Too many failed attempts |
| `session_not_found` | 404 | Session does not exist |
| `token_expired` | 401 | Access token has expired |
| `unauthorized` | 401 | No valid authentication |
| `forbidden` | 403 | Missing required permission |

---

**Document Version**: 1.0  
**Created**: December 3, 2025  
**Status**: APPROVED

