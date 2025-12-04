/**
 * DeleteTeam Handler - DELETE /api/staff/teams/{teamId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findTeamById, deleteTeam } from '../../lib/teamRepository';
import { publishTeamEvent, STAFF_EVENTS } from '../../lib/eventPublisher';

export async function DeleteTeamHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('DeleteTeam invoked');

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

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Delete team
    await deleteTeam(teamId);

    // Publish event
    await publishTeamEvent(STAFF_EVENTS.TEAM_DELETED, teamId, {
      name: existing.name,
      deletedBy: userId,
    });

    return {
      status: 204,
      body: undefined,
    };
  } catch (error) {
    context.error('DeleteTeam error:', error);

    // Check for specific errors
    if (error instanceof Error) {
      if (error.message.includes('active members')) {
        return {
          status: 400,
          jsonBody: {
            error: 'Bad Request',
            message: error.message,
          },
        };
      }
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

app.http('DeleteTeam', {
  methods: ['DELETE'],
  route: 'staff/teams/{teamId}',
  authLevel: 'anonymous',
  handler: DeleteTeamHandler,
});

