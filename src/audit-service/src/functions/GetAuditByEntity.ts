/**
 * Get Audit By Entity Handler
 * GET /api/audit/entity/{entityType}/{entityId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryByEntity } from '../lib/auditRepository';
import { getConfig } from '../lib/config';

export async function GetAuditByEntityHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetAuditByEntity function processing request');

  try {
    // TODO: Add permission check for audit:read

    const entityType = request.params.entityType;
    const entityId = request.params.entityId;

    if (!entityType) {
      return {
        status: 400,
        jsonBody: { error: 'entityType parameter is required' },
      };
    }

    if (!entityId) {
      return {
        status: 400,
        jsonBody: { error: 'entityId parameter is required' },
      };
    }

    // Parse query parameters
    const config = getConfig();
    const limitParam = request.query.get('limit');
    const limit = limitParam 
      ? Math.min(parseInt(limitParam, 10), config.query.maxLimit)
      : config.query.defaultLimit;
    const continuationToken = request.query.get('continuationToken') || undefined;

    // Query audit logs
    const result = await queryByEntity(entityType, entityId, {
      limit,
      continuationToken,
    });

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('GetAuditByEntity error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetAuditByEntity', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'audit/entity/{entityType}/{entityId}',
  handler: GetAuditByEntityHandler,
});

