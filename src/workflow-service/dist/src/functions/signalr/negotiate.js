"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.negotiateHandler = void 0;
const functions_1 = require("@azure/functions");
const httpResponses_1 = require("../../lib/utils/httpResponses");
const corsHelper_1 = require("../../lib/utils/corsHelper");
const config_1 = require("../../lib/config");
const auth_1 = require("../../lib/utils/auth");
/**
 * SignalR negotiate endpoint
 * Returns connection info for clients to connect to SignalR
 */
async function negotiateHandler(request, context) {
    const preflightResponse = (0, corsHelper_1.handlePreflight)(request);
    if (preflightResponse)
        return preflightResponse;
    try {
        const config = (0, config_1.getConfig)();
        if (!config.signalr?.connectionString) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.internalErrorResponse)('SignalR is not configured'));
        }
        const user = await (0, auth_1.getUserFromRequest)(request);
        const hubName = config.signalr.hubName;
        // Parse the connection string to extract endpoint and key
        const connectionString = config.signalr.connectionString;
        const endpointMatch = connectionString.match(/Endpoint=([^;]+)/i);
        const keyMatch = connectionString.match(/AccessKey=([^;]+)/i);
        if (!endpointMatch || !keyMatch) {
            return (0, corsHelper_1.withCors)((0, httpResponses_1.internalErrorResponse)('Invalid SignalR connection string'));
        }
        const endpoint = endpointMatch[1].replace(/^https?:\/\//, '');
        const accessKey = keyMatch[1];
        // Generate access token
        // Using JWT format expected by Azure SignalR
        const audience = `https://${endpoint}/client/?hub=${hubName}`;
        const expiry = Math.floor(Date.now() / 1000) + 3600; // 1 hour
        // Simple JWT token generation (in production, use a proper JWT library)
        const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
        const payload = Buffer.from(JSON.stringify({
            aud: audience,
            exp: expiry,
            iat: Math.floor(Date.now() / 1000),
            nameid: user.userId,
        })).toString('base64url');
        const crypto = await Promise.resolve().then(() => __importStar(require('crypto')));
        const signature = crypto
            .createHmac('sha256', accessKey)
            .update(`${header}.${payload}`)
            .digest('base64url');
        const accessToken = `${header}.${payload}.${signature}`;
        return (0, corsHelper_1.withCors)((0, httpResponses_1.successResponse)({
            url: `https://${endpoint}/client/?hub=${hubName}`,
            accessToken,
        }));
    }
    catch (error) {
        context.log('SignalR negotiate error:', error);
        return (0, corsHelper_1.withCors)((0, httpResponses_1.handleError)(error));
    }
}
exports.negotiateHandler = negotiateHandler;
functions_1.app.http('negotiate', {
    methods: ['POST', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'signalr/negotiate',
    handler: negotiateHandler,
});
//# sourceMappingURL=negotiate.js.map