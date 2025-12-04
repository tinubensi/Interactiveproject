import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateState,
  verifyState,
} from '../../../lib/pkceHelper';

describe('PKCE Helper', () => {
  describe('generateCodeVerifier', () => {
    it('should generate a code verifier of correct length', () => {
      const verifier = generateCodeVerifier();
      assert.ok(verifier.length >= 43 && verifier.length <= 128);
    });

    it('should generate unique verifiers', () => {
      const verifier1 = generateCodeVerifier();
      const verifier2 = generateCodeVerifier();
      assert.notStrictEqual(verifier1, verifier2);
    });

    it('should only contain allowed characters (A-Z, a-z, 0-9, -, _, ., ~)', () => {
      const verifier = generateCodeVerifier();
      const validChars = /^[A-Za-z0-9\-._~]+$/;
      assert.ok(validChars.test(verifier), 'Verifier contains invalid characters');
    });
  });

  describe('generateCodeChallenge', () => {
    it('should generate a valid code challenge from verifier', async () => {
      const verifier = 'test-verifier-12345678901234567890123456789012345';
      const challenge = await generateCodeChallenge(verifier);
      
      // Code challenge should be base64url encoded
      assert.ok(challenge.length > 0);
      assert.ok(!challenge.includes('+'), 'Should use base64url encoding (no +)');
      assert.ok(!challenge.includes('/'), 'Should use base64url encoding (no /)');
      assert.ok(!challenge.includes('='), 'Should not have padding');
    });

    it('should generate consistent challenges for same verifier', async () => {
      const verifier = 'consistent-test-verifier-1234567890123456789012';
      const challenge1 = await generateCodeChallenge(verifier);
      const challenge2 = await generateCodeChallenge(verifier);
      assert.strictEqual(challenge1, challenge2);
    });

    it('should generate different challenges for different verifiers', async () => {
      const verifier1 = 'test-verifier-111111111111111111111111111111111';
      const verifier2 = 'test-verifier-222222222222222222222222222222222';
      const challenge1 = await generateCodeChallenge(verifier1);
      const challenge2 = await generateCodeChallenge(verifier2);
      assert.notStrictEqual(challenge1, challenge2);
    });
  });

  describe('generateState', () => {
    it('should generate state with redirect URI', () => {
      const redirectUri = '/dashboard';
      const state = generateState(redirectUri, 'test-secret');
      
      assert.ok(state.length > 0);
      assert.ok(typeof state === 'string');
    });

    it('should generate unique states', () => {
      const redirectUri = '/dashboard';
      const state1 = generateState(redirectUri, 'test-secret');
      const state2 = generateState(redirectUri, 'test-secret');
      assert.notStrictEqual(state1, state2);
    });
  });

  describe('verifyState', () => {
    it('should verify valid state and extract redirect URI', () => {
      const redirectUri = '/dashboard';
      const secret = 'test-secret-key';
      const state = generateState(redirectUri, secret);
      
      const result = verifyState(state, secret);
      assert.ok(result.valid);
      assert.strictEqual(result.redirectUri, redirectUri);
    });

    it('should reject invalid state', () => {
      const result = verifyState('invalid-state', 'test-secret');
      assert.strictEqual(result.valid, false);
    });

    it('should reject tampered state', () => {
      const redirectUri = '/dashboard';
      const secret = 'test-secret-key';
      const state = generateState(redirectUri, secret);
      
      // Tamper with the state
      const tamperedState = state.slice(0, -5) + 'xxxxx';
      const result = verifyState(tamperedState, secret);
      assert.strictEqual(result.valid, false);
    });

    it('should reject state verified with wrong secret', () => {
      const redirectUri = '/dashboard';
      const state = generateState(redirectUri, 'correct-secret');
      
      const result = verifyState(state, 'wrong-secret');
      assert.strictEqual(result.valid, false);
    });
  });
});

