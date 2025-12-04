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
 */
export function createAccessTokenCookie(token: string): Cookie {
  const config = getConfig();
  
  return {
    name: COOKIE_NAMES.ACCESS_TOKEN,
    value: token,
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite === 'strict' ? 'Strict' : 
              config.cookies.sameSite === 'lax' ? 'Lax' : 'None',
    maxAge: config.tokens.accessTokenLifetime,
    path: '/',
    domain: config.cookies.domain !== 'localhost' ? config.cookies.domain : undefined,
  };
}

/**
 * Create refresh token cookie
 */
export function createRefreshTokenCookie(token: string): Cookie {
  const config = getConfig();
  
  return {
    name: COOKIE_NAMES.REFRESH_TOKEN,
    value: token,
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite === 'strict' ? 'Strict' : 
              config.cookies.sameSite === 'lax' ? 'Lax' : 'None',
    maxAge: config.tokens.refreshTokenLifetime,
    path: '/api/auth/refresh', // Only sent to refresh endpoint
    domain: config.cookies.domain !== 'localhost' ? config.cookies.domain : undefined,
  };
}

/**
 * Create PKCE verifier cookie (short-lived)
 */
export function createPkceVerifierCookie(verifier: string): Cookie {
  const config = getConfig();
  
  return {
    name: COOKIE_NAMES.PKCE_VERIFIER,
    value: verifier,
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: config.cookies.sameSite === 'strict' ? 'Strict' : 
              config.cookies.sameSite === 'lax' ? 'Lax' : 'None',
    maxAge: 5 * 60, // 5 minutes
    path: '/api/auth/callback',
    domain: config.cookies.domain !== 'localhost' ? config.cookies.domain : undefined,
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
    sameSite: 'Strict',
    maxAge: 0,
    path: '/api/auth/callback',
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

