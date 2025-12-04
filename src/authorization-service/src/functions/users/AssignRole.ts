/**
 * Assign Role Handler
 * POST /api/authz/users/{userId}/roles
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { assignRole } from '../../lib/userRoleRepository';
import { publishEvent, AUTH_EVENTS, RoleAssignmentEventPayload } from '../../lib/eventPublisher';
import { AssignRoleRequest } from '../../models/UserRole';

export async function AssignRoleHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('AssignRole function processing request');

  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    // Get assigning user from header (will be set by auth middleware)
    const assignedBy = request.headers.get('x-user-id') || 'system';

    // Parse request body
    const body = await request.json() as AssignRoleRequest;

    if (!body.roleId) {
      return {
        status: 400,
        jsonBody: { error: 'roleId is required' },
      };
    }

    // Assign the role
    const result = await assignRole(userId, body.roleId, assignedBy);

    // If approval is required, return different response
    if (result.approvalRequired) {
      // Publish approval required event
      const eventPayload: RoleAssignmentEventPayload = {
        userId,
        roleId: body.roleId,
        assignedBy,
        reason: body.reason,
        timestamp: new Date().toISOString(),
      };

      await publishEvent(
        AUTH_EVENTS.ROLE_APPROVAL_REQUIRED,
        `/users/${userId}/roles/${body.roleId}`,
        eventPayload
      );

      return {
        status: 202,
        jsonBody: {
          success: false,
          approvalRequired: true,
          approvalId: result.approvalId,
          message: 'High-privilege role assignment requires approval',
        },
      };
    }

    // Publish role assigned event
    const eventPayload: RoleAssignmentEventPayload = {
      userId,
      email: result.userRoles.email,
      roleId: body.roleId,
      assignedBy,
      reason: body.reason,
      effectivePermissions: result.userRoles.effectivePermissions,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.ROLE_ASSIGNED,
      `/users/${userId}/roles/${body.roleId}`,
      eventPayload
    );

    context.log(`Role ${body.roleId} assigned to user ${userId}`);

    return {
      status: 200,
      jsonBody: {
        success: true,
        userId,
        roles: result.userRoles.roles,
        effectivePermissions: result.userRoles.effectivePermissions,
      },
    };
  } catch (error) {
    context.error('AssignRole error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: { error: error.message },
        };
      }
      if (error.message.includes('not active')) {
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

app.http('AssignRole', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/roles',
  handler: AssignRoleHandler,
});

