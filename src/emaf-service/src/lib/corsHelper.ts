/**
 * CORS Helper for EMAF Service
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';

const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://frontend-livid-xi-43.vercel.app',
];

/**
 * Get CORS headers for response
 */
export function getCorsHeaders(request: HttpRequest): Record<string, string> {
  const origin = request.headers.get('origin') || '';
  
  // Check if origin is allowed
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Service-Key, X-Quotation-Token',
    'Access-Control-Allow-Credentials': 'true',
  };
}

/**
 * Handle preflight OPTIONS request
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
 * Wrap response with CORS headers
 */
export function withCors(request: HttpRequest, response: HttpResponseInit): HttpResponseInit {
  return {
    ...response,
    headers: {
      ...getCorsHeaders(request),
      ...(response.headers || {}),
    },
  };
}
