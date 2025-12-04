/**
 * UpdateTeam Handler - PUT /api/staff/teams/{teamId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findTeamById, updateTeam } from '../../lib/teamRepository';
import { publishTeamEvent, STAFF_EVENTS } from '../../lib/eventPublisher';
import { UpdateTeamRequest } from '../../models/Team';

export async function UpdateTeamHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('UpdateTeam invoked');

  try {
    const teamId = request.params.teamId;

    if (!teamId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Team ID is required',
        },
      };
    }

    // Check if team exists
    const existing = await findTeamById(teamId);
    if (!existing) {
      return {
        status: 404,
        jsonBody: {
          error: 'Not Found',
          message: `Team "${teamId}" not found`,
        },
      };
    }

    // Parse request body
    const body = await request.json() as UpdateTeamRequest;

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Update team
    const updated = await updateTeam(teamId, body, userId);

    // Publish event
    await publishTeamEvent(STAFF_EVENTS.TEAM_UPDATED, updated.teamId, {
      name: updated.name,
      type: updated.type,
      updatedBy: userId,
      changes: Object.keys(body),
    });

    return {
      status: 200,
      jsonBody: updated,
    };
  } catch (error) {
    context.error('UpdateTeam error:', error);

    if (error instanceof Error && error.message.includes('not found')) {
      return {
        status: 404,
        jsonBody: {
          error: 'Not Found',
          message: error.message,
        },
      };
    }

    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('UpdateTeam', {
  methods: ['PUT'],
  route: 'staff/teams/{teamId}',
  authLevel: 'anonymous',
  handler: UpdateTeamHandler,
});

