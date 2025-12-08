/**
 * AddTeamMember Handler - POST /api/staff/teams/{teamId}/members/{staffId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { addTeamMember } from '../../lib/teamRepository';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';

export async function AddTeamMemberHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('AddTeamMember invoked');

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

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Add member to team
    const updated = await addTeamMember(teamId, staffId, userId);

    // Publish event
    await publishStaffEvent(STAFF_EVENTS.STAFF_TEAM_JOINED, staffId, {
      teamId,
      teamName: updated.name,
      addedBy: userId,
    });

    return {
      status: 200,
      jsonBody: {
        teamId: updated.teamId,
        staffId,
        memberCount: updated.memberCount,
        addedAt: updated.updatedAt,
      },
    };
  } catch (error) {
    context.error('AddTeamMember error:', error);

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
      if (error.message.includes('already a member')) {
        return {
          status: 409,
          jsonBody: {
            error: 'Conflict',
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

app.http('AddTeamMember', {
  methods: ['POST'],
  route: 'staff/teams/{teamId}/members/{staffId}',
  authLevel: 'anonymous',
  handler: AddTeamMemberHandler,
});

