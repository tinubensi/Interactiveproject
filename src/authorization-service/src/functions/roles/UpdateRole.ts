/**
 * Update Role Handler
 * PUT /api/authz/roles/{roleId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { updateRole } from '../../lib/roleRepository';
import { publishEvent, AUTH_EVENTS, RoleEventPayload } from '../../lib/eventPublisher';
import { UpdateRoleRequest } from '../../models/RoleDefinition';

export async function UpdateRoleHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('UpdateRole function processing request');

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

    // Parse request body
    const body = await request.json() as UpdateRoleRequest;

    // At least one field must be provided
    if (!body.displayName && !body.description && !body.permissions &&
        body.azureAdGroup === undefined && body.inheritsFrom === undefined &&
        body.isHighPrivilege === undefined && body.isActive === undefined) {
      return {
        status: 400,
        jsonBody: { error: 'At least one field to update must be provided' },
      };
    }

    // Update the role
    const role = await updateRole(roleId, body, userId);

    // Publish event
    const eventPayload: RoleEventPayload = {
      roleId: role.roleId,
      displayName: role.displayName,
      permissions: role.permissions,
      performedBy: userId,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.ROLE_UPDATED,
      `/roles/${role.roleId}`,
      eventPayload
    );

    context.log(`Role updated: ${role.roleId}`);

    return {
      status: 200,
      jsonBody: role,
    };
  } catch (error) {
    context.error('UpdateRole error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: { error: error.message },
        };
      }
      if (error.message.includes('Invalid') ||
          error.message.includes('cannot inherit')) {
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

app.http('UpdateRole', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'authz/roles/{roleId}',
  handler: UpdateRoleHandler,
});

