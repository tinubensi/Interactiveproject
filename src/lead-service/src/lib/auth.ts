/**
 * Authentication utilities - Stub version for local development
 */

import { HttpRequest } from '@azure/functions';

// Stub types
export interface UserContext {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  name?: string; // Added for pipeline-service
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export async function extractUserContext(request: HttpRequest): Promise<UserContext | null> {
  return {
    userId: 'local-user-1',
    email: 'dev@local.com',
    role: 'admin',
    permissions: ['*'],
    name: 'Dev User'
  };
}

export async function ensureAuthorized(request: HttpRequest): Promise<UserContext> {
  return {
    userId: 'local-user-1',
    email: 'dev@local.com',
    role: 'admin',
    permissions: ['*'],
    name: 'Dev User'
  };
}

export async function checkPermission(userId: string, permission: string): Promise<boolean> {
  return true;
}

export async function requirePermission(userId: string, permission: string): Promise<void> {
  return;
}

export function validateServiceKey(request: HttpRequest): void {
  const serviceKey = request.headers.get('x-service-key');
  const expectedKey = process.env.INTERNAL_SERVICE_KEY;
  if (!expectedKey) {
    console.warn('INTERNAL_SERVICE_KEY not configured - skipping validation');
    return;
  }
  if (serviceKey !== expectedKey) {
    throw new AuthError('Invalid service key');
  }
}

// All permission constants
export const FORM_PERMISSIONS = {
  FORMS_CREATE: 'forms:create',
  FORMS_READ: 'forms:read',
  FORMS_UPDATE: 'forms:update',
  FORMS_DELETE: 'forms:delete',
  FORMS_MANAGE: 'forms:manage',
  FORMS_SUBMIT: 'forms:submit',
} as const;

export const QUOTATION_PERMISSIONS = {
  QUOTATIONS_CREATE: 'quotations:create',
  QUOTATIONS_READ: 'quotations:read',
  QUOTATIONS_UPDATE: 'quotations:update',
  QUOTATIONS_DELETE: 'quotations:delete',
} as const;

export const CUSTOMER_PERMISSIONS = {
  CUSTOMERS_CREATE: 'customers:create',
  CUSTOMERS_READ: 'customers:read',
  CUSTOMERS_UPDATE: 'customers:update',
  CUSTOMERS_DELETE: 'customers:delete',
  ADMIN_DEBUG: 'customers:admin:debug', // Added for customer-service
  POLICIES_READ: 'policies:read', // Added for customer-service
} as const;

export const POLICY_PERMISSIONS = {
  POLICIES_CREATE: 'policies:create',
  POLICIES_READ: 'policies:read',
  POLICIES_UPDATE: 'policies:update',
  POLICIES_DELETE: 'policies:delete',
  POLICIES_ENDORSE: 'policies:endorse', // Added for policy-service
} as const;

export const DOCUMENT_PERMISSIONS = {
  DOCUMENTS_CREATE: 'documents:create',
  DOCUMENTS_READ: 'documents:read',
  DOCUMENTS_UPDATE: 'documents:update',
  DOCUMENTS_DELETE: 'documents:delete',
  DOCUMENTS_UPLOAD: 'documents:upload', // Added for document-service
} as const;

export const LEAD_PERMISSIONS = {
  LEADS_CREATE: 'leads:create',
  LEADS_READ: 'leads:read',
  LEADS_UPDATE: 'leads:update',
  LEADS_DELETE: 'leads:delete',
} as const;

export const QUOTES_PERMISSIONS = {
  QUOTES_READ: 'quotes:read',
  QUOTES_CREATE: 'quotes:create',
  QUOTES_UPDATE: 'quotes:update',
  QUOTES_DELETE: 'quotes:delete',
} as const;

export const QUOTE_PERMISSIONS = QUOTES_PERMISSIONS;

export const PIPELINE_PERMISSIONS = {
  PIPELINES_CREATE: 'pipelines:create',
  PIPELINES_READ: 'pipelines:read',
  PIPELINES_UPDATE: 'pipelines:update',
  PIPELINES_DELETE: 'pipelines:delete',
  PIPELINES_MANAGE: 'pipelines:manage',
  PIPELINES_ACTIVATE: 'pipelines:activate',
  INSTANCES_READ: 'instances:read',
  INSTANCES_MANAGE: 'instances:manage',
  APPROVALS_READ: 'approvals:read',
} as const;
