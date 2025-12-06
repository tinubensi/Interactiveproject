/**
 * Get Role Handler
 * GET /api/authz/roles/{roleId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getRoleWithEffectivePermissions } from '../../lib/roleRepository';

export async function GetRoleHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetRole function processing request');

  try {
    const roleId = request.params.roleId;

    if (!roleId) {
      return {
        status: 400,
        jsonBody: { error: 'roleId parameter is required' },
      };
    }

    const role = await getRoleWithEffectivePermissions(roleId);

    if (!role) {
      return {
        status: 404,
        jsonBody: { error: `Role "${roleId}" not found` },
      };
    }

    return {
      status: 200,
      jsonBody: role,
    };
  } catch (error) {
    context.error('GetRole error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetRole', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'authz/roles/{roleId}',
  handler: GetRoleHandler,
});

