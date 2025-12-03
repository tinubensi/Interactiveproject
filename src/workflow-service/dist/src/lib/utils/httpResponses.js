"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.preflightResponse = exports.handleError = exports.internalErrorResponse = exports.conflictResponse = exports.notFoundResponse = exports.forbiddenResponse = exports.unauthorizedResponse = exports.badRequestResponse = exports.noContentResponse = exports.createdResponse = exports.successResponse = exports.jsonResponse = void 0;
const validation_1 = require("../validation");
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
const jsonResponse = (status, body) => {
    return {
        status,
        headers: {
            'Content-Type': 'application/json',
            ...CORS_HEADERS
        },
        body: JSON.stringify(body)
    };
};
exports.jsonResponse = jsonResponse;
const successResponse = (body) => {
    return (0, exports.jsonResponse)(200, body);
};
exports.successResponse = successResponse;
const createdResponse = (body) => {
    return (0, exports.jsonResponse)(201, body);
};
exports.createdResponse = createdResponse;
const noContentResponse = () => {
    return {
        status: 204,
        headers: CORS_HEADERS
    };
};
exports.noContentResponse = noContentResponse;
const badRequestResponse = (message, errors) => {
    return (0, exports.jsonResponse)(400, {
        error: 'Bad Request',
        message,
        errors
    });
};
exports.badRequestResponse = badRequestResponse;
const unauthorizedResponse = (message = 'Unauthorized') => {
    return (0, exports.jsonResponse)(401, {
        error: 'Unauthorized',
        message
    });
};
exports.unauthorizedResponse = unauthorizedResponse;
const forbiddenResponse = (message = 'Forbidden') => {
    return (0, exports.jsonResponse)(403, {
        error: 'Forbidden',
        message
    });
};
exports.forbiddenResponse = forbiddenResponse;
const notFoundResponse = (resource = 'Resource') => {
    return (0, exports.jsonResponse)(404, {
        error: 'Not Found',
        message: `${resource} not found`
    });
};
exports.notFoundResponse = notFoundResponse;
const conflictResponse = (message) => {
    return (0, exports.jsonResponse)(409, {
        error: 'Conflict',
        message
    });
};
exports.conflictResponse = conflictResponse;
const internalErrorResponse = (message = 'Internal server error') => {
    return (0, exports.jsonResponse)(500, {
        error: 'Internal Server Error',
        message
    });
};
exports.internalErrorResponse = internalErrorResponse;
const handleError = (error) => {
    if (error instanceof validation_1.ValidationError) {
        return (0, exports.badRequestResponse)(error.message, error.errors);
    }
    if (error instanceof Error) {
        // Check for specific error types
        if (error.message.includes('not found')) {
            return (0, exports.notFoundResponse)();
        }
        if (error.message.includes('already exists')) {
            return (0, exports.conflictResponse)(error.message);
        }
        if (error.message.includes('unauthorized') ||
            error.message.includes('Unauthorized')) {
            return (0, exports.unauthorizedResponse)(error.message);
        }
        if (error.message.includes('forbidden') ||
            error.message.includes('Forbidden')) {
            return (0, exports.forbiddenResponse)(error.message);
        }
        return (0, exports.internalErrorResponse)(error.message);
    }
    return (0, exports.internalErrorResponse)();
};
exports.handleError = handleError;
const preflightResponse = () => {
    return {
        status: 204,
        headers: CORS_HEADERS
    };
};
exports.preflightResponse = preflightResponse;
//# sourceMappingURL=httpResponses.js.map