/**
 * Sync From Azure AD Handler
 * POST /api/authz/users/{userId}/sync
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { syncFromAzureAd, getUserRoles } from '../../lib/userRoleRepository';
import { getGroupMapping } from '../../lib/azureAdMapper';
import { publishEvent, AUTH_EVENTS, RoleAssignmentEventPayload } from '../../lib/eventPublisher';
import { SyncAzureAdRequest } from '../../models/UserRole';

export async function SyncFromAzureAdHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('SyncFromAzureAd function processing request');

  try {
    const userId = request.params.userId;

    if (!userId) {
      return {
        status: 400,
        jsonBody: { error: 'userId parameter is required' },
      };
    }

    // Parse request body
    const body = await request.json() as SyncAzureAdRequest;

    if (!body.azureAdGroups || !Array.isArray(body.azureAdGroups)) {
      return {
        status: 400,
        jsonBody: { error: 'azureAdGroups array is required' },
      };
    }

    // Get user's email from existing record or from request
    const existingUser = await getUserRoles(userId);
    const email = existingUser?.email || request.headers.get('x-user-email') || '';
    const organizationId = existingUser?.organizationId || request.headers.get('x-org-id') || 'default';

    // Get group to role mapping
    const groupToRoleMapping = getGroupMapping();

    // Sync roles
    const result = await syncFromAzureAd(
      userId,
      email,
      body.azureAdGroups,
      groupToRoleMapping,
      organizationId
    );

    // Publish events for role changes
    const timestamp = new Date().toISOString();

    for (const roleId of result.rolesAdded) {
      const eventPayload: RoleAssignmentEventPayload = {
        userId,
        email,
        roleId,
        assignedBy: 'azure_ad_sync',
        reason: 'Azure AD group sync',
        timestamp,
      };

      await publishEvent(
        AUTH_EVENTS.ROLE_ASSIGNED,
        `/users/${userId}/roles/${roleId}`,
        eventPayload
      );
    }

    for (const roleId of result.rolesRemoved) {
      const eventPayload: RoleAssignmentEventPayload = {
        userId,
        email,
        roleId,
        removedBy: 'azure_ad_sync',
        reason: 'Azure AD group sync',
        timestamp,
      };

      await publishEvent(
        AUTH_EVENTS.ROLE_REMOVED,
        `/users/${userId}/roles/${roleId}`,
        eventPayload
      );
    }

    context.log(`Azure AD sync completed for user ${userId}: +${result.rolesAdded.length} -${result.rolesRemoved.length}`);

    return {
      status: 200,
      jsonBody: {
        userId,
        previousRoles: result.previousRoles,
        currentRoles: result.currentRoles,
        rolesAdded: result.rolesAdded,
        rolesRemoved: result.rolesRemoved,
        syncedAt: timestamp,
      },
    };
  } catch (error) {
    context.error('SyncFromAzureAd error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('SyncFromAzureAd', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'authz/users/{userId}/sync',
  handler: SyncFromAzureAdHandler,
});

