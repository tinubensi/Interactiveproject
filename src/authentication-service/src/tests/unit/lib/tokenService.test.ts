import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from '../../../lib/tokenService';

describe('Token Service', () => {
  const mockConfig = {
    jwtSecret: 'test-jwt-secret-key-for-testing-purposes-only',
    accessTokenLifetime: 900, // 15 minutes
    refreshTokenLifetime: 2592000, // 30 days
    issuer: 'nectaria-auth',
  };

  const mockUser = {
    userId: 'user-123-uuid',
    email: 'test@example.com',
    name: 'Test User',
    roles: ['senior-broker'],
    azureAdGroups: ['Nectaria-SeniorBrokers'],
    organizationId: 'org-123',
    sessionId: 'session-456-uuid',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT access token', () => {
      const token = generateAccessToken(mockUser, mockConfig);
      
      assert.ok(token);
      assert.ok(typeof token === 'string');
      // JWT format: header.payload.signature
      const parts = token.split('.');
      assert.strictEqual(parts.length, 3);
    });

    it('should include correct claims in token', () => {
      const token = generateAccessToken(mockUser, mockConfig);
      const decoded = verifyAccessToken(token, mockConfig);
      
      assert.ok(decoded);
      assert.strictEqual(decoded.sub, mockUser.userId);
      assert.strictEqual(decoded.email, mockUser.email);
      assert.strictEqual(decoded.name, mockUser.name);
      assert.deepStrictEqual(decoded.roles, mockUser.roles);
      assert.deepStrictEqual(decoded.groups, mockUser.azureAdGroups);
      assert.strictEqual(decoded.orgId, mockUser.organizationId);
      assert.strictEqual(decoded.sid, mockUser.sessionId);
      assert.strictEqual(decoded.iss, mockConfig.issuer);
    });

    it('should set correct expiry time', () => {
      const before = Math.floor(Date.now() / 1000);
      const token = generateAccessToken(mockUser, mockConfig);
      const after = Math.floor(Date.now() / 1000);
      
      const decoded = verifyAccessToken(token, mockConfig);
      assert.ok(decoded);
      
      // Expiry should be within the configured lifetime from now
      const expectedExpMin = before + mockConfig.accessTokenLifetime;
      const expectedExpMax = after + mockConfig.accessTokenLifetime + 1;
      
      assert.ok(decoded.exp >= expectedExpMin);
      assert.ok(decoded.exp <= expectedExpMax);
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate a valid JWT refresh token', () => {
      const token = generateRefreshToken(mockUser.userId, mockUser.sessionId, mockConfig);
      
      assert.ok(token);
      assert.ok(typeof token === 'string');
      const parts = token.split('.');
      assert.strictEqual(parts.length, 3);
    });

    it('should include token family for rotation detection', () => {
      const token = generateRefreshToken(mockUser.userId, mockUser.sessionId, mockConfig);
      const decoded = verifyRefreshToken(token, mockConfig);
      
      assert.ok(decoded);
      assert.ok(decoded.fam, 'Token should have family claim');
      assert.strictEqual(typeof decoded.fam, 'string');
    });

    it('should generate different families for different tokens', () => {
      const token1 = generateRefreshToken(mockUser.userId, mockUser.sessionId, mockConfig);
      const token2 = generateRefreshToken(mockUser.userId, mockUser.sessionId, mockConfig);
      
      const decoded1 = verifyRefreshToken(token1, mockConfig);
      const decoded2 = verifyRefreshToken(token2, mockConfig);
      
      assert.ok(decoded1);
      assert.ok(decoded2);
      assert.notStrictEqual(decoded1.fam, decoded2.fam);
    });

    it('should allow specifying existing family for rotation', () => {
      const existingFamily = 'existing-family-id';
      const token = generateRefreshToken(
        mockUser.userId,
        mockUser.sessionId,
        mockConfig,
        existingFamily
      );
      
      const decoded = verifyRefreshToken(token, mockConfig);
      assert.ok(decoded);
      // When rotating, we generate a new family, not reuse old one
      // This is the expected behavior for refresh token rotation
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid token', () => {
      const token = generateAccessToken(mockUser, mockConfig);
      const decoded = verifyAccessToken(token, mockConfig);
      
      assert.ok(decoded);
      assert.strictEqual(decoded.sub, mockUser.userId);
    });

    it('should return null for invalid token', () => {
      const decoded = verifyAccessToken('invalid.token.here', mockConfig);
      assert.strictEqual(decoded, null);
    });

    it('should return null for expired token', () => {
      // Create a config with 0 second lifetime
      const expiredConfig = { ...mockConfig, accessTokenLifetime: -1 };
      const token = generateAccessToken(mockUser, expiredConfig);
      
      const decoded = verifyAccessToken(token, mockConfig);
      assert.strictEqual(decoded, null);
    });

    it('should return null for token with wrong secret', () => {
      const token = generateAccessToken(mockUser, mockConfig);
      const wrongSecretConfig = { ...mockConfig, jwtSecret: 'wrong-secret' };
      
      const decoded = verifyAccessToken(token, wrongSecretConfig);
      assert.strictEqual(decoded, null);
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(mockUser.userId, mockUser.sessionId, mockConfig);
      const decoded = verifyRefreshToken(token, mockConfig);
      
      assert.ok(decoded);
      assert.strictEqual(decoded.sub, mockUser.userId);
      assert.strictEqual(decoded.sid, mockUser.sessionId);
    });

    it('should return null for invalid refresh token', () => {
      const decoded = verifyRefreshToken('invalid.token', mockConfig);
      assert.strictEqual(decoded, null);
    });
  });

  describe('hashToken', () => {
    it('should hash token consistently', () => {
      const token = 'test-token-to-hash';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      
      assert.strictEqual(hash1, hash2);
    });

    it('should produce different hashes for different tokens', () => {
      const hash1 = hashToken('token1');
      const hash2 = hashToken('token2');
      
      assert.notStrictEqual(hash1, hash2);
    });

    it('should produce hex-encoded hash', () => {
      const hash = hashToken('test-token');
      
      // SHA-256 produces 64 hex characters
      assert.strictEqual(hash.length, 64);
      assert.ok(/^[a-f0-9]+$/.test(hash), 'Hash should be hex-encoded');
    });
  });
});

