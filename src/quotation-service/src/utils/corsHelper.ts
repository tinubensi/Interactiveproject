/**
 * CORS Helper for Quotation Service
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
  const origin = request.headers.get('origin') || '';
  
  // Allow all origins in development
  const allowedOrigin = origin || '*';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ms-client-request-id',
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


