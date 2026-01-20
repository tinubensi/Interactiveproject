/**
 * Cookie Helper - HTTP cookie utilities
 */

import type { Cookie } from '@azure/functions';
import { getConfig } from './config';

/**
 * Cookie names
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'nectaria_access_token',
  REFRESH_TOKEN: 'nectaria_refresh_token',
  PKCE_VERIFIER: 'nectaria_pkce_verifier',
} as const;

/**
 * Create access token cookie
 * 
 * For cross-site requests (any external domain -> azurewebsites.net), we need SameSite=None with Secure=true
 * This includes both localhost and production frontends (Vercel, etc.)
 */
export function createAccessTokenCookie(token: string): Cookie {
  const config = getConfig();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // Check if frontend is on a different domain than the backend
  // Backend is always: func-nectaria-authentication-dev.azurewebsites.net
  // If frontend is localhost, vercel.app, or any other domain, it's cross-site
  const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
  const isVercel = frontendUrl.includes('vercel.app');
  const isCrossSite = isLocalhost || isVercel || !frontendUrl.includes('azurewebsites.net');
  
  // For cross-site requests, ALWAYS use SameSite=None with Secure=true
  // For same-site requests, use SameSite=Lax
  const sameSite = isCrossSite ? 'None' : (config.cookies.sameSite === 'strict' ? 'Strict' : 'Lax');
  const secure = true; // Always true since backend is HTTPS
  
  return {
    name: COOKIE_NAMES.ACCESS_TOKEN,
    value: token,
    httpOnly: true,
    secure: secure,
    sameSite: sameSite === 'Strict' ? 'Strict' : sameSite === 'Lax' ? 'Lax' : 'None',
    maxAge: config.tokens.accessTokenLifetime,
    path: '/',
    domain: undefined, // Don't set domain for cross-site cookies
  };
}

/**
 * Create refresh token cookie
 * 
 * For cross-site requests (any external domain -> azurewebsites.net), we need SameSite=None with Secure=true
 */
export function createRefreshTokenCookie(token: string): Cookie {
  const config = getConfig();
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  
  // Check if frontend is on a different domain than the backend
  const isLocalhost = frontendUrl.includes('localhost') || frontendUrl.includes('127.0.0.1');
  const isVercel = frontendUrl.includes('vercel.app');
  const isCrossSite = isLocalhost || isVercel || !frontendUrl.includes('azurewebsites.net');
  
  // For cross-site requests, ALWAYS use SameSite=None with Secure=true
  const sameSite = isCrossSite ? 'None' : (config.cookies.sameSite === 'strict' ? 'Strict' : 'Lax');
  const secure = true; // Always true since backend is HTTPS
  
  return {
    name: COOKIE_NAMES.REFRESH_TOKEN,
    value: token,
    httpOnly: true,
    secure: secure,
    sameSite: sameSite === 'Strict' ? 'Strict' : sameSite === 'Lax' ? 'Lax' : 'None',
    maxAge: config.tokens.refreshTokenLifetime,
    path: '/api/auth/refresh', // Only sent to refresh endpoint
    domain: undefined, // Don't set domain for cross-site cookies
  };
}

/**
 * Create PKCE verifier cookie (short-lived)
 * 
 * IMPORTANT: This cookie must survive cross-site OAuth redirects (Azure AD -> callback)
 * Therefore it MUST use SameSite=None with Secure=true
 */
export function createPkceVerifierCookie(verifier: string): Cookie {
  const config = getConfig();
  
  return {
    name: COOKIE_NAMES.PKCE_VERIFIER,
    value: verifier,
    httpOnly: true,
    secure: true, // MUST be true when using SameSite=None (backend is HTTPS, so this works)
    sameSite: 'None',  // MUST be None for cross-site OAuth redirects from Azure AD
    maxAge: 5 * 60, // 5 minutes
    path: '/',  // Use root path to ensure cookie is sent to all auth endpoints
    domain: undefined, // Don't set domain - let browser use default (exact domain match)
  };
}

/**
 * Create cookie to clear access token
 */
export function clearAccessTokenCookie(): Cookie {
  return {
    name: COOKIE_NAMES.ACCESS_TOKEN,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 0,
    path: '/',
  };
}

/**
 * Create cookie to clear refresh token
 */
export function clearRefreshTokenCookie(): Cookie {
  return {
    name: COOKIE_NAMES.REFRESH_TOKEN,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'Strict',
    maxAge: 0,
    path: '/api/auth/refresh',
  };
}

/**
 * Create cookie to clear PKCE verifier
 */
export function clearPkceVerifierCookie(): Cookie {
  return {
    name: COOKIE_NAMES.PKCE_VERIFIER,
    value: '',
    httpOnly: true,
    secure: true,
    sameSite: 'None', // Must match createPkceVerifierCookie
    maxAge: 0,
    path: '/',  // Must match the path used in createPkceVerifierCookie
  };
}

/**
 * Parse cookies from Cookie header
 */
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  
  if (!cookieHeader) {
    return cookies;
  }
  
  const pairs = cookieHeader.split(';');
  
  for (const pair of pairs) {
    const [key, ...valueParts] = pair.trim().split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('='); // Handle values with = in them
      cookies[key.trim()] = decodeURIComponent(value);
    }
  }
  
  return cookies;
}

/**
 * Get access token from cookies
 */
export function getAccessTokenFromCookies(cookieHeader: string | null): string | null {
  const cookies = parseCookies(cookieHeader);
  return cookies[COOKIE_NAMES.ACCESS_TOKEN] || null;
}

/**
 * Get refresh token from cookies
 */
export function getRefreshTokenFromCookies(cookieHeader: string | null): string | null {
  const cookies = parseCookies(cookieHeader);
  return cookies[COOKIE_NAMES.REFRESH_TOKEN] || null;
}

/**
 * Get PKCE verifier from cookies
 */
export function getPkceVerifierFromCookies(cookieHeader: string | null): string | null {
  const cookies = parseCookies(cookieHeader);
  return cookies[COOKIE_NAMES.PKCE_VERIFIER] || null;
}

