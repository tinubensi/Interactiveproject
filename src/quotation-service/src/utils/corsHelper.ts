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
];

/**
 * Get allowed origins including environment-configured frontend URL
 */
function getAllowedOrigins(): string[] {
  const origins = [...ALLOWED_ORIGINS];
  
  // Add frontend URL from environment if set
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl && !origins.includes(frontendUrl)) {
    // Remove trailing slash if present
    const cleanUrl = frontendUrl.endsWith('/') ? frontendUrl.slice(0, -1) : frontendUrl;
    origins.push(cleanUrl);
  }
  
  return origins;
}

/**
 * Check if origin is allowed
 */
function isOriginAllowed(origin: string): boolean {
  const allowedOrigins = getAllowedOrigins();
  
  // Direct match
  if (allowedOrigins.includes(origin)) {
    return true;
  }
  
  // Allow all Vercel app domains
  if (origin.endsWith('.vercel.app')) {
    return true;
  }
  
  // Allow Azure Static Web Apps domains
  if (origin.endsWith('.azurestaticapps.net')) {
    return true;
  }
  
  return false;
}

/**
 * Get CORS headers for a given request
 */
export function getCorsHeaders(request: HttpRequest): Record<string, string> {
  const origin = request.headers.get('origin') || 'http://localhost:3000';
  
  // Use the requesting origin if allowed, otherwise use localhost default
  const allowedOrigin = isOriginAllowed(origin) ? origin : 'http://localhost:3000';
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
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


