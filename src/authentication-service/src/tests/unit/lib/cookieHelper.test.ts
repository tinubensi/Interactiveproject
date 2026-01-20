import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createAccessTokenCookie, createRefreshTokenCookie } from '../../../lib/cookieHelper';

describe('cookieHelper - Cross-Site Cookie Configuration', () => {
  const originalEnv = process.env.FRONTEND_URL;

  after(() => {
    // Restore original environment
    if (originalEnv) {
      process.env.FRONTEND_URL = originalEnv;
    } else {
      delete process.env.FRONTEND_URL;
    }
  });

  describe('createAccessTokenCookie', () => {
    it('should use SameSite=None for localhost (cross-site)', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      const cookie = createAccessTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'None', 'Should use SameSite=None for localhost');
      assert.strictEqual(cookie.secure, true, 'Should use Secure=true for cross-site');
      assert.strictEqual(cookie.domain, undefined, 'Should not set domain for cross-site');
    });

    it('should use SameSite=None for Vercel (cross-site)', () => {
      process.env.FRONTEND_URL = 'https://frontend-livid-xi-43.vercel.app';
      const cookie = createAccessTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'None', 'Should use SameSite=None for Vercel');
      assert.strictEqual(cookie.secure, true, 'Should use Secure=true for cross-site');
      assert.strictEqual(cookie.domain, undefined, 'Should not set domain for cross-site');
    });

    it('should use SameSite=None for any non-azurewebsites.net domain (cross-site)', () => {
      process.env.FRONTEND_URL = 'https://example.com';
      const cookie = createAccessTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'None', 'Should use SameSite=None for external domains');
      assert.strictEqual(cookie.secure, true, 'Should use Secure=true for cross-site');
    });

    it('should use SameSite=Lax for azurewebsites.net (same-site)', () => {
      process.env.FRONTEND_URL = 'https://func-nectaria-authentication-dev.azurewebsites.net';
      const cookie = createAccessTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'Lax', 'Should use SameSite=Lax for same-site');
      assert.strictEqual(cookie.secure, true, 'Should always use Secure=true');
    });
  });

  describe('createRefreshTokenCookie', () => {
    it('should use SameSite=None for localhost (cross-site)', () => {
      process.env.FRONTEND_URL = 'http://localhost:3000';
      const cookie = createRefreshTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'None', 'Should use SameSite=None for localhost');
      assert.strictEqual(cookie.secure, true, 'Should use Secure=true for cross-site');
      assert.strictEqual(cookie.domain, undefined, 'Should not set domain for cross-site');
    });

    it('should use SameSite=None for Vercel (cross-site)', () => {
      process.env.FRONTEND_URL = 'https://frontend-livid-xi-43.vercel.app';
      const cookie = createRefreshTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'None', 'Should use SameSite=None for Vercel');
      assert.strictEqual(cookie.secure, true, 'Should use Secure=true for cross-site');
      assert.strictEqual(cookie.domain, undefined, 'Should not set domain for cross-site');
    });

    it('should use SameSite=None for any non-azurewebsites.net domain (cross-site)', () => {
      process.env.FRONTEND_URL = 'https://example.com';
      const cookie = createRefreshTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'None', 'Should use SameSite=None for external domains');
      assert.strictEqual(cookie.secure, true, 'Should use Secure=true for cross-site');
    });

    it('should use SameSite=Lax for azurewebsites.net (same-site)', () => {
      process.env.FRONTEND_URL = 'https://func-nectaria-authentication-dev.azurewebsites.net';
      const cookie = createRefreshTokenCookie('test-token');
      
      assert.strictEqual(cookie.sameSite, 'Lax', 'Should use SameSite=Lax for same-site');
      assert.strictEqual(cookie.secure, true, 'Should always use Secure=true');
    });
  });
});
