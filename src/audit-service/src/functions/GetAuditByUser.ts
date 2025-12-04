/**
 * Get Audit By User Handler
 * GET /api/audit/user/{userId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { queryByUser } from '../lib/auditRepository';
import { getConfig } from '../lib/config';

export async function GetAuditByUserHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetAuditByUser function processing request');

  try {
    // TODO: Add permission check for audit:read

    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    // Parse query parameters
    const config = getConfig();
    const limitParam = request.query.get('limit');
    const limit = limitParam 
      ? Math.min(parseInt(limitParam, 10), config.query.maxLimit)
      : config.query.defaultLimit;
    const startDate = request.query.get('startDate') || undefined;
    const endDate = request.query.get('endDate') || undefined;
    const action = request.query.get('action') || undefined;
    const continuationToken = request.query.get('continuationToken') || undefined;

    // Query audit logs
    const result = await queryByUser(userId, {
      startDate,
      endDate,
      action,
      limit,
      continuationToken,
    });

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('GetAuditByUser error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetAuditByUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'audit/user/{userId}',
  handler: GetAuditByUserHandler,
});

