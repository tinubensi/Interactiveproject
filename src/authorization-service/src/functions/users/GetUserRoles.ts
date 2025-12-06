/**
 * Get User Roles Handler
 * GET /api/authz/users/{userId}/roles
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserRoles, getActiveTempPermissions } from '../../lib/userRoleRepository';

export async function GetUserRolesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetUserRoles function processing request');

  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    const userRoles = await getUserRoles(userId);

    if (!userRoles) {
      return {
        status: 404,
        jsonBody: { error: `User "${userId}" not found` },
      };
    }

    // Get active temporary permissions
    const activeTempPerms = getActiveTempPermissions(userRoles);

    return {
      status: 200,
      jsonBody: {
        userId: userRoles.userId,
        email: userRoles.email,
        roles: userRoles.roles,
        effectivePermissions: userRoles.effectivePermissions,
        temporaryPermissions: activeTempPerms.map((p) => ({
          id: p.id,
          permission: p.permission,
          validUntil: p.validUntil,
          reason: p.reason,
        })),
        territory: userRoles.territory,
        teamId: userRoles.teamId,
        source: userRoles.source,
        syncedAt: userRoles.syncedAt,
      },
    };
  } catch (error) {
    context.error('GetUserRoles error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetUserRoles', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/roles',
  handler: GetUserRolesHandler,
});

