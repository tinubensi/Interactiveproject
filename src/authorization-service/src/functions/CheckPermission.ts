/**
 * Check Permission Handler (Internal - Service Key)
 * POST /api/authz/check
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateServiceKey } from '../lib/config';
import { getUserRoles, getAllUserPermissions } from '../lib/userRoleRepository';
import { hasPermission } from '../lib/permissionResolver';
import { getCachedPermission, cachePermission } from '../lib/cacheRepository';
import { publishEvent, AUTH_EVENTS, PermissionDeniedEventPayload } from '../lib/eventPublisher';
import { CheckPermissionRequest, CheckPermissionResponse } from '../models/PermissionCache';

export async function CheckPermissionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CheckPermission function processing request');

  try {
    // Validate service key
    const serviceKey = request.headers.get('x-service-key');
    if (!validateServiceKey(serviceKey || undefined)) {
      return {
        status: 401,
        jsonBody: { error: 'Invalid or missing service key' },
      };
    }

    // Parse request body
    const body = await request.json() as CheckPermissionRequest;

    if (!body.userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId is required' },
      };
    }

    if (!body.permission) {
      return {
        status: 400,
        jsonBody: { error: 'permission is required' },
      };
    }

    // Check cache first
    const cached = await getCachedPermission(body.userId, body.permission);
    if (cached) {
      context.log(`Cache hit for ${body.userId}:${body.permission}`);
      const response: CheckPermissionResponse = {
        authorized: cached.authorized,
        userId: body.userId,
        matchedPermission: cached.matchedPermission,
        reason: cached.reason,
      };
      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Get user roles
    const userRoles = await getUserRoles(body.userId);
    if (!userRoles) {
      const response: CheckPermissionResponse = {
        authorized: false,
        userId: body.userId,
        reason: 'user_not_found',
      };

      // Cache negative result
      await cachePermission(body.userId, body.permission, false, {
        reason: 'user_not_found',
      });

      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Get all permissions including temporary ones
    const allPermissions = getAllUserPermissions(userRoles);

    // Check permission
    const result = hasPermission(allPermissions, body.permission);

    if (result.authorized) {
      const response: CheckPermissionResponse = {
        authorized: true,
        userId: body.userId,
        roles: userRoles.roles,
        matchedPermission: result.matchedPermission,
      };

      // Cache positive result
      await cachePermission(body.userId, body.permission, true, {
        matchedPermission: result.matchedPermission,
        matchedScope: result.scope,
      });

      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Permission denied
    const response: CheckPermissionResponse = {
      authorized: false,
      userId: body.userId,
      reason: 'insufficient_permissions',
      required: body.permission,
      userPermissions: allPermissions,
    };

    // Cache negative result
    await cachePermission(body.userId, body.permission, false, {
      reason: 'insufficient_permissions',
    });

    // Publish permission denied event
    const eventPayload: PermissionDeniedEventPayload = {
      userId: body.userId,
      email: userRoles.email,
      permission: body.permission,
      resource: { type: 'unknown', id: null },
      userRoles: userRoles.roles,
      userPermissions: allPermissions,
      timestamp: new Date().toISOString(),
    };

    await publishEvent(
      AUTH_EVENTS.PERMISSION_DENIED,
      `/users/${body.userId}`,
      eventPayload
    );

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error('CheckPermission error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('CheckPermission', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'authz/check',
  handler: CheckPermissionHandler,
});

