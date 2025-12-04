/**
 * Create Audit Log Handler (Internal - Service Key)
 * POST /api/audit/log
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { createAuditLog } from '../lib/auditRepository';
import { validateServiceKey } from '../lib/config';
import { sanitizeChanges } from '../lib/piiSanitizer';
import { CreateAuditLogRequest } from '../models/AuditLog';

export async function CreateAuditLogHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateAuditLog function processing request');

  try {
    // Validate service key
    const serviceKey = request.headers.get('x-service-key');
    if (!validateServiceKey(serviceKey || undefined)) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid or missing service key' },
      };
    }

    // Parse request body
    const body = await request.json() as CreateAuditLogRequest;

    // Validate required fields
    if (!body.entityType) {
      return {
        status: 400,
        jsonBody: { error: 'entityType is required' },
      };
    }

    if (!body.entityId) {
      return {
        status: 400,
        jsonBody: { error: 'entityId is required' },
      };
    }

    if (!body.action) {
      return {
        status: 400,
        jsonBody: { error: 'action is required' },
      };
    }

    if (!body.category) {
      return {
        status: 400,
        jsonBody: { error: 'category is required' },
      };
    }

    if (!body.severity) {
      return {
        status: 400,
        jsonBody: { error: 'severity is required' },
      };
    }

    if (!body.actor || !body.actor.id) {
      return {
        status: 400,
        jsonBody: { error: 'actor with id is required' },
      };
    }

    if (!body.context || !body.context.serviceName) {
      return {
        status: 400,
        jsonBody: { error: 'context with serviceName is required' },
      };
    }

    // Sanitize PII from changes
    const sanitizedChanges = sanitizeChanges(body.changes);

    // Create audit log
    const auditLog = await createAuditLog({
      entityType: body.entityType,
      entityId: body.entityId,
      action: body.action,
      category: body.category,
      severity: body.severity,
      actor: {
        id: body.actor.id,
        email: body.actor.email || '',
        name: body.actor.name,
        roles: body.actor.roles,
        type: body.actor.type || 'service',
      },
      context: {
        ipAddress: body.context.ipAddress || 'internal',
        userAgent: body.context.userAgent || 'internal-service',
        requestId: body.context.requestId || uuidv4(),
        serviceName: body.context.serviceName,
        correlationId: body.context.correlationId,
      },
      changes: sanitizedChanges,
      metadata: body.metadata,
    });

    return {
      status: 201,
      jsonBody: {
        id: auditLog.id,
        timestamp: auditLog.timestamp,
      },
    };
  } catch (error) {
    context.error('CreateAuditLog error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('CreateAuditLog', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'audit/log',
  handler: CreateAuditLogHandler,
});

