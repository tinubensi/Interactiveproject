/**
 * Get User Permissions Handler (Internal - Service Key)
 * GET /api/authz/users/{userId}/permissions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateServiceKey } from '../lib/config';
import { getUserRoles, getActiveTempPermissions, getAllUserPermissions } from '../lib/userRoleRepository';
import { UserPermissionsResponse } from '../models/UserRole';

export async function GetUserPermissionsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetUserPermissions function processing request');

  try {
    // Validate service key
    const serviceKey = request.headers.get('x-service-key');
    if (!validateServiceKey(serviceKey || undefined)) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid or missing service key' },
      };
    }

    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    // Get user roles
    const userRoles = await getUserRoles(userId);
    if (!userRoles) {
      return {
        status: 404,
        jsonBody: { error: `User "${userId}" not found` },
      };
    }

    // Get all permissions including temporary ones
    const allPermissions = getAllUserPermissions(userRoles);

    // Get active temporary permissions
    const activeTempPerms = getActiveTempPermissions(userRoles);

    const response: UserPermissionsResponse = {
      userId: userRoles.userId,
      roles: userRoles.roles,
      permissions: allPermissions,
      temporaryPermissions: activeTempPerms.map((p) => ({
        permission: p.permission,
        validUntil: p.validUntil,
        reason: p.reason,
      })),
      territory: userRoles.territory,
      teamId: userRoles.teamId,
    };

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error('GetUserPermissions error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetUserPermissions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/permissions',
  handler: GetUserPermissionsHandler,
});

