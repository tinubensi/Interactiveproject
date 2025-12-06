import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { ValidationError } from '../validation';
import { getCorsHeaders } from './corsHelper';

/**
 * Get response headers with CORS - uses request origin if available
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
): HttpResponseInit => {
  return {
    status,
    headers: getResponseHeaders(request),
    body: JSON.stringify(body)
  };
};

export const successResponse = (body: unknown, request?: HttpRequest): HttpResponseInit => {
  return jsonResponse(200, body, request);
};

export const createdResponse = (body: unknown, request?: HttpRequest): HttpResponseInit => {
  return jsonResponse(201, body, request);
};

export const noContentResponse = (request?: HttpRequest): HttpResponseInit => {
  return {
    status: 204,
    headers: request ? getCorsHeaders(request) : getResponseHeaders()
  };
};

export const badRequestResponse = (
  message: string,
  errors?: Array<{ path: string; message: string }>,
  request?: HttpRequest
): HttpResponseInit => {
  return jsonResponse(400, {
    error: 'Bad Request',
    message,
    errors
  }, request);
};

export const unauthorizedResponse = (
  message: string = 'Unauthorized',
  request?: HttpRequest
): HttpResponseInit => {
  return jsonResponse(401, {
    error: 'Unauthorized',
    message
  }, request);
};

export const forbiddenResponse = (
  message: string = 'Forbidden',
  request?: HttpRequest
): HttpResponseInit => {
  return jsonResponse(403, {
    error: 'Forbidden',
    message
  }, request);
};

export const notFoundResponse = (
  resource: string = 'Resource',
  request?: HttpRequest
): HttpResponseInit => {
  return jsonResponse(404, {
    error: 'Not Found',
    message: `${resource} not found`
  }, request);
};

export const conflictResponse = (message: string, request?: HttpRequest): HttpResponseInit => {
  return jsonResponse(409, {
    error: 'Conflict',
    message
  }, request);
};

export const internalErrorResponse = (
  message: string = 'Internal server error',
  request?: HttpRequest
): HttpResponseInit => {
  return jsonResponse(500, {
    error: 'Internal Server Error',
    message
  }, request);
};

export const handleError = (error: unknown, request?: HttpRequest): HttpResponseInit => {
  if (error instanceof ValidationError) {
    return badRequestResponse(error.message, error.errors, request);
  }

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('not found')) {
      return notFoundResponse(undefined, request);
    }
    if (error.message.includes('already exists')) {
      return conflictResponse(error.message, request);
    }
    if (
      error.message.includes('unauthorized') ||
      error.message.includes('Unauthorized')
    ) {
      return unauthorizedResponse(error.message, request);
    }
    if (
      error.message.includes('forbidden') ||
      error.message.includes('Forbidden')
    ) {
      return forbiddenResponse(error.message, request);
    }

    return internalErrorResponse(error.message, request);
  }

  return internalErrorResponse(undefined, request);
};

export const preflightResponse = (request?: HttpRequest): HttpResponseInit => {
  return {
    status: 204,
    headers: request ? getCorsHeaders(request) : getResponseHeaders()
  };
};
