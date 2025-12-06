import { HttpRequest, HttpResponseInit } from '@azure/functions';

/**
 * Get CORS headers for a given request
 * Echoes back the origin header to support credentials
 */
export function getCorsHeaders(request: HttpRequest): Record<string, string> {
  const origin = request.headers.get('origin') || 'http://localhost:3000';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export const handlePreflight = (
  request: HttpRequest
): HttpResponseInit | null => {
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: getCorsHeaders(request)
    };
  }
  return null;
};

/**
 * Wraps an HTTP response with CORS headers
 */
export const withCors = (request: HttpRequest, response: HttpResponseInit): HttpResponseInit => {
  return {
    ...response,
    headers: {
      ...getCorsHeaders(request),
      ...response.headers
    }
  };
};
