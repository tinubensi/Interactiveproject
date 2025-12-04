/**
 * PKCE (Proof Key for Code Exchange) Helper
 * Implements RFC 7636 for secure OAuth 2.0 authorization code flow
 */

import { createHash, randomBytes } from 'crypto';

/**
 * Generate a cryptographically random code verifier
 * Per RFC 7636, must be 43-128 characters from [A-Z], [a-z], [0-9], "-", ".", "_", "~"
 */
export function generateCodeVerifier(): string {
  // Generate 32 random bytes (will become 43 base64url characters)
  const bytes = randomBytes(32);
  return base64UrlEncode(bytes);
}

/**
 * Generate code challenge from verifier using S256 method
 * challenge = BASE64URL(SHA256(verifier))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const hash = createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}

/**
 * Generate nonce for replay protection
 */
export function generateNonce(): string {
  return randomBytes(16).toString('hex');
}

/**
 * State parameter structure
 */
interface StatePayload {
  nonce: string;
  redirectUri: string;
  timestamp: number;
}

/**
 * Generate state parameter with encrypted redirect URI for CSRF protection
 * State format: base64url(JSON) + "." + signature
 */
export function generateState(redirectUri: string, secret: string): string {
  const payload: StatePayload = {
    nonce: generateNonce(),
    redirectUri,
    timestamp: Date.now(),
  };
  
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadStr));
  
  // Create HMAC signature
  const signature = createHash('sha256')
    .update(payloadB64 + secret)
    .digest();
  const signatureB64 = base64UrlEncode(signature);
  
  return `${payloadB64}.${signatureB64}`;
}

/**
 * Verify state parameter and extract redirect URI
 */
export function verifyState(
  state: string,
  secret: string
): { valid: boolean; redirectUri?: string } {
  try {
    const parts = state.split('.');
    if (parts.length !== 2) {
      return { valid: false };
    }
    
    const [payloadB64, signatureB64] = parts;
    
    // Verify signature
    const expectedSignature = createHash('sha256')
      .update(payloadB64 + secret)
      .digest();
    const expectedSignatureB64 = base64UrlEncode(expectedSignature);
    
    if (signatureB64 !== expectedSignatureB64) {
      return { valid: false };
    }
    
    // Decode payload
    const payloadStr = base64UrlDecode(payloadB64).toString();
    const payload: StatePayload = JSON.parse(payloadStr);
    
    // Check timestamp (valid for 10 minutes)
    const maxAge = 10 * 60 * 1000; // 10 minutes
    if (Date.now() - payload.timestamp > maxAge) {
      return { valid: false };
    }
    
    return { valid: true, redirectUri: payload.redirectUri };
  } catch {
    return { valid: false };
  }
}

/**
 * Base64 URL encode (RFC 4648)
 */
function base64UrlEncode(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64 URL decode
 */
function base64UrlDecode(str: string): Buffer {
  // Add padding if needed
  let padded = str;
  const padding = (4 - (str.length % 4)) % 4;
  padded += '='.repeat(padding);
  
  // Convert from URL-safe to standard base64
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  
  return Buffer.from(base64, 'base64');
}

