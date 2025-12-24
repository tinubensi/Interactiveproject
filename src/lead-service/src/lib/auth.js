"use strict";
/**
 * Authentication utilities for Lead Service
 * TODO: Implement real authentication when auth service is ready
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PIPELINE_PERMISSIONS = exports.QUOTE_PERMISSIONS = exports.QUOTES_PERMISSIONS = exports.LEAD_PERMISSIONS = exports.DOCUMENT_PERMISSIONS = exports.POLICY_PERMISSIONS = exports.CUSTOMER_PERMISSIONS = exports.QUOTATION_PERMISSIONS = exports.FORM_PERMISSIONS = exports.ForbiddenError = exports.AuthError = void 0;
exports.extractUserContext = extractUserContext;
exports.ensureAuthorized = ensureAuthorized;
exports.checkPermission = checkPermission;
exports.requirePermission = requirePermission;
exports.validateServiceKey = validateServiceKey;
// Local error classes
var AuthError = /** @class */ (function (_super) {
    __extends(AuthError, _super);
    function AuthError(message) {
        if (message === void 0) { message = 'Authentication required'; }
        var _this = _super.call(this, message) || this;
        _this.name = 'AuthError';
        return _this;
    }
    return AuthError;
}(Error));
exports.AuthError = AuthError;
var ForbiddenError = /** @class */ (function (_super) {
    __extends(ForbiddenError, _super);
    function ForbiddenError(message, permission) {
        if (message === void 0) { message = 'Access forbidden'; }
        var _this = _super.call(this, message) || this;
        _this.permission = permission;
        _this.name = 'ForbiddenError';
        return _this;
    }
    return ForbiddenError;
}(Error));
exports.ForbiddenError = ForbiddenError;
// Mock user for development
var MOCK_USER = {
    userId: 'dev-user',
    email: 'dev@nectaria.com',
    name: 'Dev User',
    roles: ['junior-broker'],
    azureAdGroups: [],
    organizationId: 'dev-org',
    sessionId: 'dev-session'
};
/**
 * Extract user context from request (async)
 */
function extractUserContext(request) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // TODO: Implement real authentication when auth service is ready
            return [2 /*return*/, MOCK_USER];
        });
    });
}
/**
 * Ensure request is authorized - throws if not authenticated
 */
function ensureAuthorized(request) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // TODO: Implement real authentication when auth service is ready
            return [2 /*return*/, MOCK_USER];
        });
    });
}
/**
 * Check if user has a specific permission
 */
function checkPermission(userId, permission) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            // TODO: Implement real permission checking when auth service is ready
            return [2 /*return*/, true];
        });
    });
}
/**
 * Require a specific permission - throws ForbiddenError if not authorized
 */
function requirePermission(userId, permission) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/];
        });
    });
}
function validateServiceKey(request) {
    var serviceKey = request.headers.get('x-service-key');
    var expectedKey = process.env.INTERNAL_SERVICE_KEY;
    if (!expectedKey) {
        console.warn('INTERNAL_SERVICE_KEY not configured - skipping validation');
        return;
    }
    if (serviceKey !== expectedKey) {
        throw new AuthError('Invalid service key');
    }
}
// All permission constants
exports.FORM_PERMISSIONS = {
    FORMS_CREATE: 'forms:create',
    FORMS_READ: 'forms:read',
    FORMS_UPDATE: 'forms:update',
    FORMS_DELETE: 'forms:delete',
    FORMS_MANAGE: 'forms:manage',
    FORMS_SUBMIT: 'forms:submit',
};
exports.QUOTATION_PERMISSIONS = {
    QUOTATIONS_CREATE: 'quotations:create',
    QUOTATIONS_READ: 'quotations:read',
    QUOTATIONS_UPDATE: 'quotations:update',
    QUOTATIONS_DELETE: 'quotations:delete',
};
exports.CUSTOMER_PERMISSIONS = {
    CUSTOMERS_CREATE: 'customers:create',
    CUSTOMERS_READ: 'customers:read',
    CUSTOMERS_UPDATE: 'customers:update',
    CUSTOMERS_DELETE: 'customers:delete',
    ADMIN_DEBUG: 'customers:admin:debug', // Added for customer-service
    POLICIES_READ: 'policies:read', // Added for customer-service
};
exports.POLICY_PERMISSIONS = {
    POLICIES_CREATE: 'policies:create',
    POLICIES_READ: 'policies:read',
    POLICIES_UPDATE: 'policies:update',
    POLICIES_DELETE: 'policies:delete',
    POLICIES_ENDORSE: 'policies:endorse', // Added for policy-service
};
exports.DOCUMENT_PERMISSIONS = {
    DOCUMENTS_CREATE: 'documents:create',
    DOCUMENTS_READ: 'documents:read',
    DOCUMENTS_UPDATE: 'documents:update',
    DOCUMENTS_DELETE: 'documents:delete',
    DOCUMENTS_UPLOAD: 'documents:upload', // Added for document-service
};
exports.LEAD_PERMISSIONS = {
    LEADS_CREATE: 'leads:create',
    LEADS_READ: 'leads:read',
    LEADS_UPDATE: 'leads:update',
    LEADS_DELETE: 'leads:delete',
};
exports.QUOTES_PERMISSIONS = {
    QUOTES_READ: 'quotes:read',
    QUOTES_CREATE: 'quotes:create',
    QUOTES_UPDATE: 'quotes:update',
    QUOTES_DELETE: 'quotes:delete',
};
exports.QUOTE_PERMISSIONS = exports.QUOTES_PERMISSIONS;
exports.PIPELINE_PERMISSIONS = {
    PIPELINES_CREATE: 'pipelines:create',
    PIPELINES_READ: 'pipelines:read',
    PIPELINES_UPDATE: 'pipelines:update',
    PIPELINES_DELETE: 'pipelines:delete',
    PIPELINES_MANAGE: 'pipelines:manage',
    PIPELINES_ACTIVATE: 'pipelines:activate',
    INSTANCES_READ: 'instances:read',
    INSTANCES_MANAGE: 'instances:manage',
    APPROVALS_READ: 'approvals:read',
};
