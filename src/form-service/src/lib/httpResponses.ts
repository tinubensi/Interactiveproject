import { HttpResponseInit } from '@azure/functions';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const jsonResponse = (
  status: number,
  body: unknown
): HttpResponseInit => ({
  status,
  jsonBody: body,
  headers: CORS_HEADERS
});

export const handleError = (error: unknown): HttpResponseInit => {
  if (error instanceof Error) {
    return jsonResponse(400, { 
      success: false,
      error: error.message 
    });
  }
  return jsonResponse(500, { 
    success: false,
    error: 'Unexpected error' 
  });
};

