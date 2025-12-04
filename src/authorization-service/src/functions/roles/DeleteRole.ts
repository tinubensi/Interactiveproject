/**
 * Delete Role Handler
 * DELETE /api/authz/roles/{roleId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { deleteRole, getRoleById } from '../../lib/roleRepository';
import { publishEvent, AUTH_EVENTS, RoleEventPayload } from '../../lib/eventPublisher';

export async function DeleteRoleHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('DeleteRole function processing request');

  try {
    const roleId = request.params.roleId;

    if (!roleId) {
      return {
        status: 400,
        jsonBody: { error: 'roleId parameter is required' },
      };
    }

    // Get user from header (will be set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Get role info for event before deleting
    const role = await getRoleById(roleId);
    if (!role) {
      return {
        status: 404,
        jsonBody: { error: `Role "${roleId}" not found` },
      };
    }

    // Delete the role
    await deleteRole(roleId, userId);

    // Publish event
    const eventPayload: RoleEventPayload = {
      roleId: role.roleId,
      displayName: role.displayName,
      performedBy: userId,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.ROLE_DELETED,
      `/roles/${role.roleId}`,
      eventPayload
    );

    context.log(`Role deleted: ${roleId}`);

    return {
      status: 204,
      body: undefined,
    };
  } catch (error) {
    context.error('DeleteRole error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: { error: error.message },
        };
      }
      if (error.message.includes('Cannot delete system role')) {
        return {
          status: 403,
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

app.http('DeleteRole', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'authz/roles/{roleId}',
  handler: DeleteRoleHandler,
});

