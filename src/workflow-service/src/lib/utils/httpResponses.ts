import { HttpResponseInit } from '@azure/functions';
import { ValidationError } from '../validation';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const jsonResponse = (
  status: number,
  body: unknown
): HttpResponseInit => {
  return {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    },
    body: JSON.stringify(body)
  };
};

export const successResponse = (body: unknown): HttpResponseInit => {
  return jsonResponse(200, body);
};

export const createdResponse = (body: unknown): HttpResponseInit => {
  return jsonResponse(201, body);
};

export const noContentResponse = (): HttpResponseInit => {
  return {
    status: 204,
    headers: CORS_HEADERS
  };
};

export const badRequestResponse = (
  message: string,
  errors?: Array<{ path: string; message: string }>
): HttpResponseInit => {
  return jsonResponse(400, {
    error: 'Bad Request',
    message,
    errors
  });
};

export const unauthorizedResponse = (
  message: string = 'Unauthorized'
): HttpResponseInit => {
  return jsonResponse(401, {
    error: 'Unauthorized',
    message
  });
};

export const forbiddenResponse = (
  message: string = 'Forbidden'
): HttpResponseInit => {
  return jsonResponse(403, {
    error: 'Forbidden',
    message
  });
};

export const notFoundResponse = (
  resource: string = 'Resource'
): HttpResponseInit => {
  return jsonResponse(404, {
    error: 'Not Found',
    message: `${resource} not found`
  });
};

export const conflictResponse = (message: string): HttpResponseInit => {
  return jsonResponse(409, {
    error: 'Conflict',
    message
  });
};

export const internalErrorResponse = (
  message: string = 'Internal server error'
): HttpResponseInit => {
  return jsonResponse(500, {
    error: 'Internal Server Error',
    message
  });
};

export const handleError = (error: unknown): HttpResponseInit => {
  if (error instanceof ValidationError) {
    return badRequestResponse(error.message, error.errors);
  }

  if (error instanceof Error) {
    // Check for specific error types
    if (error.message.includes('not found')) {
      return notFoundResponse();
    }
    if (error.message.includes('already exists')) {
      return conflictResponse(error.message);
    }
    if (
      error.message.includes('unauthorized') ||
      error.message.includes('Unauthorized')
    ) {
      return unauthorizedResponse(error.message);
    }
    if (
      error.message.includes('forbidden') ||
      error.message.includes('Forbidden')
    ) {
      return forbiddenResponse(error.message);
    }

    return internalErrorResponse(error.message);
  }

  return internalErrorResponse();
};

export const preflightResponse = (): HttpResponseInit => {
  return {
    status: 204,
    headers: CORS_HEADERS
  };
};

