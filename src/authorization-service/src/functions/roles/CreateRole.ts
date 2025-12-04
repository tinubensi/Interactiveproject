/**
 * Create Role Handler
 * POST /api/authz/roles
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createRole } from '../../lib/roleRepository';
import { publishEvent, AUTH_EVENTS, RoleEventPayload } from '../../lib/eventPublisher';
import { CreateRoleRequest } from '../../models/RoleDefinition';

export async function CreateRoleHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateRole function processing request');

  try {
    // TODO: Add authentication/authorization check
    // For now, extract user from header (will be set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Parse request body
    const body = await request.json() as CreateRoleRequest;

    // Validate required fields
    if (!body.roleId) {
      return {
        status: 400,
        jsonBody: { error: 'roleId is required' },
      };
    }
    if (!body.displayName) {
      return {
        status: 400,
        jsonBody: { error: 'displayName is required' },
      };
    }
    if (!body.description) {
      return {
        status: 400,
        jsonBody: { error: 'description is required' },
      };
    }
    if (!body.permissions || body.permissions.length === 0) {
      return {
        status: 400,
        jsonBody: { error: 'permissions is required and must not be empty' },
      };
    }

    // Create the role
    const role = await createRole(body, userId);

    // Publish event
    const eventPayload: RoleEventPayload = {
      roleId: role.roleId,
      displayName: role.displayName,
      permissions: role.permissions,
      performedBy: userId,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.ROLE_CREATED,
      `/roles/${role.roleId}`,
      eventPayload
    );

    context.log(`Role created: ${role.roleId}`);

    return {
      status: 201,
      jsonBody: role,
    };
  } catch (error) {
    context.error('CreateRole error:', error);

    if (error instanceof Error) {
      // Handle known errors
      if (error.message.includes('already exists') ||
          error.message.includes('reserved') ||
          error.message.includes('Invalid')) {
        return {
          status: 400,
          jsonBody: { error: error.message },
        };
      }
      if (error.message.includes('does not exist')) {
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

app.http('CreateRole', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'authz/roles',
  handler: CreateRoleHandler,
});

