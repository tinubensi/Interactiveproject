import { HttpRequest, HttpResponseInit } from '@azure/functions';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

export const handlePreflight = (request: HttpRequest): HttpResponseInit | null => {
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: CORS_HEADERS
    };
  }
  return null;
};

