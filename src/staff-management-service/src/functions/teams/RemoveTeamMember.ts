/**
 * RemoveTeamMember Handler - DELETE /api/staff/teams/{teamId}/members/{staffId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { removeTeamMember, findTeamById } from '../../lib/teamRepository';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';

export async function RemoveTeamMemberHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('RemoveTeamMember invoked');

  try {
    const teamId = request.params.teamId;
    const staffId = request.params.staffId;

    if (!teamId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Team ID is required',
        },
      };
    }

    if (!staffId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Staff ID is required',
        },
      };
    }

    // Get team name before removal
    const team = await findTeamById(teamId);
    if (!team) {
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

    // Remove member from team
    const updated = await removeTeamMember(teamId, staffId, userId);

    // Publish event
    await publishStaffEvent(STAFF_EVENTS.STAFF_TEAM_LEFT, staffId, {
      teamId,
      teamName: team.name,
      removedBy: userId,
    });

    return {
      status: 200,
      jsonBody: {
        teamId: updated.teamId,
        staffId,
        memberCount: updated.memberCount,
        removedAt: updated.updatedAt,
      },
    };
  } catch (error) {
    context.error('RemoveTeamMember error:', error);

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return {
          status: 404,
          jsonBody: {
            error: 'Not Found',
            message: error.message,
          },
        };
      }
      if (error.message.includes('not a member') || error.message.includes('team leader') || error.message.includes('at least one team')) {
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

app.http('RemoveTeamMember', {
  methods: ['DELETE'],
  route: 'staff/teams/{teamId}/members/{staffId}',
  authLevel: 'anonymous',
  handler: RemoveTeamMemberHandler,
});

