/**
 * CreateTeam Handler - POST /api/staff/teams
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createTeam } from '../../lib/teamRepository';
import { publishTeamEvent, STAFF_EVENTS } from '../../lib/eventPublisher';
import { CreateTeamRequest } from '../../models/Team';

export async function CreateTeamHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateTeam invoked');

  try {
    // Parse request body
    const body = await request.json() as CreateTeamRequest;

    // Validate required fields
    if (!body.name) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Team name is required',
        },
      };
    }

    if (!body.type) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Team type is required',
        },
      };
    }

    if (!body.leaderId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Team leader ID is required',
        },
      };
    }

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Create team
    const team = await createTeam(body, userId);

    // Publish event
    await publishTeamEvent(STAFF_EVENTS.TEAM_CREATED, team.teamId, {
      name: team.name,
      type: team.type,
      leaderId: team.leaderId,
      leaderEmail: team.leaderEmail,
      territories: team.territories,
      createdBy: userId,
    });

    return {
      status: 201,
      jsonBody: {
        teamId: team.teamId,
        name: team.name,
        leaderId: team.leaderId,
        leaderEmail: team.leaderEmail,
        memberCount: team.memberCount,
        createdAt: team.createdAt,
      },
    };
  } catch (error) {
    context.error('CreateTeam error:', error);

    // Check for specific error
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

app.http('CreateTeam', {
  methods: ['POST'],
  route: 'staff/teams',
  authLevel: 'anonymous',
  handler: CreateTeamHandler,
});

