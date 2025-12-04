/**
 * Revoke Temporary Permission Handler
 * DELETE /api/authz/users/{userId}/temp-permissions/{permId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { revokeTempPermission, getUserRoles } from '../../lib/userRoleRepository';
import { publishEvent, AUTH_EVENTS, TempPermissionEventPayload } from '../../lib/eventPublisher';

export async function RevokeTempPermissionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('RevokeTempPermission function processing request');

  try {
    const userId = request.params.userId;
    const permId = request.params.permId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    if (!permId) {
      return {
        status: 400,
        jsonBody: { error: 'permId parameter is required' },
      };
    }

    // Get revoking user from header (will be set by auth middleware)
    const revokedBy = request.headers.get('x-user-id') || 'system';

    // Get user and permission info before revoking
    const userRoles = await getUserRoles(userId);
    if (!userRoles) {
      return {
        status: 404,
        jsonBody: { error: `User "${userId}" not found` },
      };
    }

    const tempPerm = userRoles.temporaryPermissions.find((p) => p.id === permId);
    if (!tempPerm) {
      return {
        status: 404,
        jsonBody: { error: `Temporary permission "${permId}" not found` },
      };
    }

    // Revoke the permission
    await revokeTempPermission(userId, permId, revokedBy);

    // Publish event
    const eventPayload: TempPermissionEventPayload = {
      userId,
      permission: tempPerm.permission,
      revokedBy,
      validUntil: tempPerm.validUntil,
      reason: `Revoked: ${tempPerm.reason}`,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.PERMISSION_TEMP_REVOKED,
      `/users/${userId}/temp-permissions/${permId}`,
      eventPayload
    );

    context.log(`Temporary permission ${permId} revoked from user ${userId}`);

    return {
      status: 204,
      body: undefined,
    };
  } catch (error) {
    context.error('RevokeTempPermission error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: { error: error.message },
        };
      }
    }

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('RevokeTempPermission', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/temp-permissions/{permId}',
  handler: RevokeTempPermissionHandler,
});

