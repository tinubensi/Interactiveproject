/**
 * CORS Helper for Pipeline Service
 * Provides consistent CORS headers across all endpoints
 */

import { HttpRequest, HttpResponseInit } from '@azure/functions';

/**
 * Get CORS headers for a given request
 */
export function getCorsHeaders(request: HttpRequest): Record<string, string> {
  const origin = request.headers.get('origin') || 'http://localhost:3000';
  
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ms-client-request-id, x-service-key',
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

/**
 * Create a success response with CORS headers
 */
export function successResponse(
  request: HttpRequest,
  data: unknown,
  status: number = 200
): HttpResponseInit {
  return withCors(request, {
    status,
    jsonBody: {
      success: true,
      data,
    },
  });
}

/**
 * Create an error response with CORS headers
 */
export function errorResponse(
  request: HttpRequest,
  message: string,
  status: number = 500,
  details?: unknown
): HttpResponseInit {
  return withCors(request, {
    status,
    jsonBody: {
      success: false,
      error: message,
      details,
    },
  });
}

/**
 * Create a not found response
 */
export function notFoundResponse(request: HttpRequest, resource: string): HttpResponseInit {
  return errorResponse(request, `${resource} not found`, 404);
}

/**
 * Create a bad request response
 */
export function badRequestResponse(request: HttpRequest, message: string): HttpResponseInit {
  return errorResponse(request, message, 400);
}

