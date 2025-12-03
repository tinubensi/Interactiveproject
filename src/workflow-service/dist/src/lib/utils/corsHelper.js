"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCors = exports.handlePreflight = void 0;
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
};
const handlePreflight = (request) => {
    if (request.method === 'OPTIONS') {
        return {
            status: 204,
            headers: corsHeaders
        };
    }
    return null;
};
exports.handlePreflight = handlePreflight;
/**
 * Wraps an HTTP response with CORS headers
 */
const withCors = (response) => {
    return {
        ...response,
        headers: {
            ...corsHeaders,
            ...response.headers
        }
    };
};
exports.withCors = withCors;
//# sourceMappingURL=corsHelper.js.map