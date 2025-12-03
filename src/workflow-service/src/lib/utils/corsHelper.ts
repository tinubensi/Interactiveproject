import { HttpRequest, HttpResponseInit } from '@azure/functions';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400'
};

export const handlePreflight = (
  request: HttpRequest
): HttpResponseInit | null => {
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: corsHeaders
    };
  }
  return null;
};

/**
 * Wraps an HTTP response with CORS headers
 */
export const withCors = (response: HttpResponseInit): HttpResponseInit => {
  return {
    ...response,
    headers: {
      ...corsHeaders,
      ...response.headers
    }
  };
};

