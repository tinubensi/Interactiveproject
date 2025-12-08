import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getCorsHeaders } from './corsHelper';

/**
 * Get CORS headers - uses request origin if available, falls back to default
 */
function getResponseHeaders(request?: HttpRequest): Record<string, string> {
  if (request) {
    return {
      'Content-Type': 'application/json',
      ...getCorsHeaders(request),
    };
  }
  // Fallback for backwards compatibility
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
}

export const jsonResponse = (
  status: number,
  body: unknown,
  request?: HttpRequest
): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: getResponseHeaders(request)
});

export const handleError = (error: unknown, request?: HttpRequest): HttpResponseInit => {
  if (error instanceof Error) {
    // Check for auth errors
    if (error.name === 'AuthError' || error.message.includes('Authentication')) {
      return jsonResponse(400, { error: error.message }, request);
    }
    if (error.name === 'ForbiddenError' || error.message.includes('permission')) {
      return jsonResponse(403, { error: error.message }, request);
    }
    return jsonResponse(400, { error: error.message }, request);
  }
  return jsonResponse(500, { error: 'Unexpected error' }, request);
};
