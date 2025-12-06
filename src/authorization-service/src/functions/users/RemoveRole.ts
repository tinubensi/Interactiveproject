/**
 * Remove Role Handler
 * DELETE /api/authz/users/{userId}/roles/{roleId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { removeRole, getUserRoles } from '../../lib/userRoleRepository';
import { publishEvent, AUTH_EVENTS, RoleAssignmentEventPayload } from '../../lib/eventPublisher';

export async function RemoveRoleHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('RemoveRole function processing request');

  try {
    const userId = request.params.userId;
    const roleId = request.params.roleId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    if (!roleId) {
      return {
        status: 400,
        jsonBody: { error: 'roleId parameter is required' },
      };
    }

    // Get removing user from header (will be set by auth middleware)
    const removedBy = request.headers.get('x-user-id') || 'system';

    // Get user info for event before removing
    const userBefore = await getUserRoles(userId);
    if (!userBefore) {
      return {
        status: 404,
        jsonBody: { error: `User "${userId}" not found` },
      };
    }

    // Remove the role
    const updatedUser = await removeRole(userId, roleId, removedBy);

    // Publish role removed event
    const eventPayload: RoleAssignmentEventPayload = {
      userId,
      email: updatedUser.email,
      roleId,
      removedBy,
      effectivePermissions: updatedUser.effectivePermissions,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.ROLE_REMOVED,
      `/users/${userId}/roles/${roleId}`,
      eventPayload
    );

    context.log(`Role ${roleId} removed from user ${userId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        userId,
        roles: updatedUser.roles,
        effectivePermissions: updatedUser.effectivePermissions,
      },
    };
  } catch (error) {
    context.error('RemoveRole error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: { error: error.message },
        };
      }
      if (error.message.includes('does not have role')) {
        return {
          status: 400,
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

app.http('RemoveRole', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/roles/{roleId}',
  handler: RemoveRoleHandler,
});

