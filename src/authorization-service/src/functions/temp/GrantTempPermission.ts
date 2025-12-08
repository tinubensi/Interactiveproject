/**
 * Grant Temporary Permission Handler
 * POST /api/authz/users/{userId}/temp-permissions
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { grantTempPermission, getUserRoles } from '../../lib/userRoleRepository';
import { publishEvent, AUTH_EVENTS, TempPermissionEventPayload } from '../../lib/eventPublisher';
import { GrantTempPermissionRequest } from '../../models/UserRole';

export async function GrantTempPermissionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GrantTempPermission function processing request');

  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    // Get granting user from header (will be set by auth middleware)
    const grantedBy = request.headers.get('x-user-id') || 'system';

    // Parse request body
    const body = await request.json() as GrantTempPermissionRequest;

    if (!body.permission) {
      return {
        status: 400,
        jsonBody: { error: 'permission is required' },
      };
    }

    if (!body.validUntil) {
      return {
        status: 400,
        jsonBody: { error: 'validUntil is required' },
      };
    }

    if (!body.reason) {
      return {
        status: 400,
        jsonBody: { error: 'reason is required' },
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

    const validFrom = body.validFrom || new Date().toISOString();

    // Grant the temporary permission
    const tempPerm = await grantTempPermission(
      userId,
      body.permission,
      grantedBy,
      body.reason,
      validFrom,
      body.validUntil
    );

    // Publish event
    const eventPayload: TempPermissionEventPayload = {
      userId,
      permission: body.permission,
      grantedBy,
      validFrom: tempPerm.validFrom,
      validUntil: tempPerm.validUntil,
      reason: body.reason,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.PERMISSION_TEMP_GRANTED,
      `/users/${userId}/temp-permissions/${tempPerm.id}`,
      eventPayload
    );

    context.log(`Temporary permission ${body.permission} granted to user ${userId}`);

    return {
      status: 201,
      jsonBody: {
        id: tempPerm.id,
        permission: tempPerm.permission,
        validFrom: tempPerm.validFrom,
        validUntil: tempPerm.validUntil,
        grantedBy: tempPerm.grantedBy,
        reason: tempPerm.reason,
      },
    };
  } catch (error) {
    context.error('GrantTempPermission error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: { error: error.message },
        };
      }
      if (error.message.includes('Cannot grant wildcard') ||
          error.message.includes('must be in the future') ||
          error.message.includes('cannot exceed')) {
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

app.http('GrantTempPermission', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/temp-permissions',
  handler: GrantTempPermissionHandler,
});

