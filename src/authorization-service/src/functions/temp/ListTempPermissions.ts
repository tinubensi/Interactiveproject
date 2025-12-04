/**
 * List Temporary Permissions Handler
 * GET /api/authz/users/{userId}/temp-permissions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getUserRoles, getActiveTempPermissions } from '../../lib/userRoleRepository';

export async function ListTempPermissionsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('ListTempPermissions function processing request');

  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    // Check user exists
    const userRoles = await getUserRoles(userId);
    if (!userRoles) {
      return {
        status: 404,
        jsonBody: { error: `User "${userId}" not found` },
      };
    }

    // Get query parameter to include expired
    const includeExpired = request.query.get('includeExpired') === 'true';

    let tempPermissions;
    if (includeExpired) {
      tempPermissions = userRoles.temporaryPermissions;
    } else {
      tempPermissions = getActiveTempPermissions(userRoles);
    }

    return {
      status: 200,
      jsonBody: {
        userId,
        temporaryPermissions: tempPermissions.map((p) => ({
          id: p.id,
          permission: p.permission,
          validFrom: p.validFrom,
          validUntil: p.validUntil,
          grantedBy: p.grantedBy,
          reason: p.reason,
          createdAt: p.createdAt,
        })),
        count: tempPermissions.length,
      },
    };
  } catch (error) {
    context.error('ListTempPermissions error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('ListTempPermissions', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/temp-permissions',
  handler: ListTempPermissionsHandler,
});

