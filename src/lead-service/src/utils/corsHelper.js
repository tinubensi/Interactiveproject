"use strict";
/**
 * CORS Helper for Lead Service
 * Provides consistent CORS headers across all endpoints
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorsHeaders = getCorsHeaders;
exports.handlePreflight = handlePreflight;
exports.withCors = withCors;
var ALLOWED_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001',
    // Add production domains here when deployed
];
/**
 * Get CORS headers for a given request
 */
function getCorsHeaders(request) {
    var requestOrigin = request.headers.get('origin');
    // If no origin header, check referer as fallback (for same-origin requests that might be proxied)
    var origin = requestOrigin;
    if (!origin) {
        var referer = request.headers.get('referer');
        if (referer) {
            try {
                var refererUrl = new URL(referer);
                origin = "".concat(refererUrl.protocol, "//").concat(refererUrl.host);
            }
            catch (_a) {
                // Invalid referer URL, use default
                origin = 'http://localhost:3000';
            }
        }
        else {
            origin = 'http://localhost:3000';
        }
    }
    // Validate origin against allowed list (case-insensitive)
    var normalizedOrigin = origin.toLowerCase();
    var isAllowed = ALLOWED_ORIGINS.some(function (allowed) {
        return normalizedOrigin === allowed.toLowerCase() ||
            normalizedOrigin === allowed.toLowerCase().replace(/\/$/, '');
    } // Remove trailing slash
    );
    // If origin is not in allowed list, check if it's localhost with any port
    var isLocalhost = normalizedOrigin.startsWith('http://localhost:') ||
        normalizedOrigin.startsWith('https://localhost:');
    // Use the origin if it's allowed or localhost, otherwise use the first allowed origin
    var allowedOrigin = (isAllowed || isLocalhost) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-ms-client-request-id',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}
/**
 * Handle OPTIONS preflight request
 */
function handlePreflight(request) {
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
function withCors(request, response) {
    return __assign(__assign({}, response), { headers: __assign(__assign({}, response.headers), getCorsHeaders(request)) });
}
