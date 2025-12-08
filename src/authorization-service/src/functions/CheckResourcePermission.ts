/**
 * Check Resource Permission Handler (Internal - Service Key)
 * POST /api/authz/check-resource
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { validateServiceKey } from '../lib/config';
import { getUserRoles, getAllUserPermissions } from '../lib/userRoleRepository';
import { hasPermission } from '../lib/permissionResolver';
import { 
  hasFullAccess, 
  getMatchingScopes, 
  checkResourceWithScopes,
  UserScopeContext 
} from '../lib/resourceChecker';
import { getCachedPermission, cachePermission } from '../lib/cacheRepository';
import { publishEvent, AUTH_EVENTS, PermissionDeniedEventPayload } from '../lib/eventPublisher';
import { 
  CheckResourcePermissionRequest, 
  CheckResourcePermissionResponse 
} from '../models/PermissionCache';

export async function CheckResourcePermissionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CheckResourcePermission function processing request');

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
    const body = await request.json() as CheckResourcePermissionRequest;

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

    if (!body.resource || !body.resource.type || !body.resource.id) {
      return {
        status: 400,
        jsonBody: { error: 'resource with type and id is required' },
      };
    }

    // Check cache first (with resource ID in key)
    const cached = await getCachedPermission(body.userId, body.permission, body.resource.id);
    if (cached) {
      context.log(`Cache hit for ${body.userId}:${body.permission}:${body.resource.id}`);
      const response: CheckResourcePermissionResponse = {
        authorized: cached.authorized,
        reason: cached.reason,
        matchedScope: cached.matchedScope,
        matchedPermission: cached.matchedPermission,
      };
      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Get user roles
    const userRoles = await getUserRoles(body.userId);
    if (!userRoles) {
      const response: CheckResourcePermissionResponse = {
        authorized: false,
        reason: 'user_not_found',
      };

      await cachePermission(body.userId, body.permission, false, {
        resourceId: body.resource.id,
        resourceType: body.resource.type,
        reason: 'user_not_found',
      });

      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Get all permissions including temporary ones
    const allPermissions = getAllUserPermissions(userRoles);

    // First check if user has the base permission at all
    const baseResult = hasPermission(allPermissions, body.permission);
    if (!baseResult.authorized) {
      const response: CheckResourcePermissionResponse = {
        authorized: false,
        reason: 'insufficient_permissions',
      };

      await cachePermission(body.userId, body.permission, false, {
        resourceId: body.resource.id,
        resourceType: body.resource.type,
        reason: 'insufficient_permissions',
      });

      // Publish permission denied event
      const eventPayload: PermissionDeniedEventPayload = {
        userId: body.userId,
        email: userRoles.email,
        permission: body.permission,
        resource: { type: body.resource.type, id: body.resource.id },
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
    }

    // Check if user has full (unscoped) access
    if (hasFullAccess(allPermissions, body.permission)) {
      const response: CheckResourcePermissionResponse = {
        authorized: true,
        reason: 'full_access',
        matchedPermission: baseResult.matchedPermission,
      };

      await cachePermission(body.userId, body.permission, true, {
        resourceId: body.resource.id,
        resourceType: body.resource.type,
        reason: 'full_access',
        matchedPermission: baseResult.matchedPermission,
      });

      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Get matching scopes and check resource access
    const scopes = getMatchingScopes(allPermissions, body.permission);
    const userScopeContext: UserScopeContext = {
      userId: body.userId,
      teamId: userRoles.teamId,
      territory: userRoles.territory,
    };

    const resourceResult = checkResourceWithScopes(scopes, userScopeContext, body.resource);

    if (resourceResult.authorized) {
      const response: CheckResourcePermissionResponse = {
        authorized: true,
        reason: resourceResult.reason,
        matchedScope: resourceResult.matchedScope,
        matchedPermission: baseResult.matchedPermission,
      };

      await cachePermission(body.userId, body.permission, true, {
        resourceId: body.resource.id,
        resourceType: body.resource.type,
        reason: resourceResult.reason,
        matchedPermission: baseResult.matchedPermission,
        matchedScope: resourceResult.matchedScope,
      });

      return {
        status: 200,
        jsonBody: response,
      };
    }

    // Resource access denied
    const response: CheckResourcePermissionResponse = {
      authorized: false,
      reason: resourceResult.reason,
    };

    await cachePermission(body.userId, body.permission, false, {
      resourceId: body.resource.id,
      resourceType: body.resource.type,
      reason: resourceResult.reason,
    });

    // Publish permission denied event
    const eventPayload: PermissionDeniedEventPayload = {
      userId: body.userId,
      email: userRoles.email,
      permission: body.permission,
      resource: { type: body.resource.type, id: body.resource.id },
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
    context.error('CheckResourcePermission error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('CheckResourcePermission', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'authz/check-resource',
  handler: CheckResourcePermissionHandler,
});

