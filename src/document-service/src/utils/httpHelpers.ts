import { HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

/**
 * HTTP Helper functions for consistent response handling
 */

export function success<T>(data: T, statusCode: number = 200): HttpResponseInit {
  return {
    status: statusCode,
    jsonBody: data,
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

export function created<T>(data: T): HttpResponseInit {
  return success(data, 201);
}

export function noContent(): HttpResponseInit {
  return {
    status: 204,
  };
}

export function badRequest(message: string): HttpResponseInit {
  return {
    status: 400,
    jsonBody: {
      error: 'Bad Request',
      message,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

export function notFound(message: string = 'Resource not found'): HttpResponseInit {
  return {
    status: 404,
    jsonBody: {
      error: 'Not Found',
      message,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

export function internalServerError(
  message: string = 'Internal server error',
  context?: InvocationContext
): HttpResponseInit {
  if (context) {
    context.error(`Internal server error: ${message}`);
  }
  return {
    status: 500,
    jsonBody: {
      error: 'Internal Server Error',
      message,
    },
    headers: {
      'Content-Type': 'application/json',
    },
  };
}

/**
 * Parse JSON body from HTTP request
 */
export async function parseJsonBody<T>(request: HttpRequest): Promise<T | null> {
  try {
    const body = await request.text();
    if (!body) {
      return null;
    }
    return JSON.parse(body) as T;
  } catch (error) {
    return null;
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(
  body: any,
  fields: string[]
): string | null {
  if (!body) {
    return 'Request body is required';
  }

  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Field '${field}' is required`;
    }
  }

  return null;
}

