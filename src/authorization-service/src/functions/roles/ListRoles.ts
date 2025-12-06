/**
 * List Roles Handler
 * GET /api/authz/roles
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listRoles } from '../../lib/roleRepository';

export async function ListRolesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('ListRoles function processing request');

  try {
    // Parse query parameters
    const activeOnly = request.query.get('activeOnly') !== 'false';
    const includeSystem = request.query.get('includeSystem') !== 'false';

    // Get roles
    const roles = await listRoles({
      activeOnly,
      includeSystem,
    });

    return {
      status: 200,
      jsonBody: {
        roles,
        count: roles.length,
      },
    };
  } catch (error) {
    context.error('ListRoles error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('ListRoles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'authz/roles',
  handler: ListRolesHandler,
});

