/**
 * CORS Helper for Lead Service
 * Provides consistent CORS headers across all endpoints
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://localhost:3000',
  'https://localhost:3001',
  // Add production domains here when deployed
];

/**
 * Get CORS headers for a given request
 */
export function getCorsHeaders(request: HttpRequest): Record<string, string> {
<<<<<<< HEAD
  const requestOrigin = request.headers.get('origin');

  // If no origin header, check referer as fallback (for same-origin requests that might be proxied)
  let origin = requestOrigin;
  if (!origin) {
    const referer = request.headers.get('referer');
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        origin = `${refererUrl.protocol}//${refererUrl.host}`;
      } catch {
        // Invalid referer URL, use default
        origin = 'http://localhost:3000';
      }
    } else {
      origin = 'http://localhost:3000';
    }
  }

  // Validate origin against allowed list (case-insensitive)
  const normalizedOrigin = origin.toLowerCase();
  const isAllowed = ALLOWED_ORIGINS.some(allowed =>
    normalizedOrigin === allowed.toLowerCase() ||
    normalizedOrigin === allowed.toLowerCase().replace(/\/$/, '') // Remove trailing slash
  );

  // If origin is not in allowed list, check if it's localhost with any port
  const isLocalhost = normalizedOrigin.startsWith('http://localhost:') ||
                      normalizedOrigin.startsWith('https://localhost:');

  // Use the origin if it's allowed or localhost, otherwise use the first allowed origin
  const allowedOrigin = (isAllowed || isLocalhost) ? origin : ALLOWED_ORIGINS[0];

=======
  const origin = request.headers.get('origin') || 'http://localhost:3000';

>>>>>>> feat/auth
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ms-client-request-id',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * Handle OPTIONS preflight request
 */
export function handlePreflight(request: HttpRequest): HttpResponseInit | null {
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: getCorsHeaders(request),
    };
  }
  return null;
}

/**
 * Add CORS headers to response
 */
export function withCors(request: HttpRequest, response: HttpResponseInit): HttpResponseInit {
  return {
    ...response,
    headers: {
      ...response.headers,
      ...getCorsHeaders(request),
    },
  };
}

