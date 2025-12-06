/**
 * GetTeam Handler - GET /api/staff/teams/{teamId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findTeamById } from '../../lib/teamRepository';

export async function GetTeamHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetTeam invoked');

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

    return {
      status: 200,
      jsonBody: team,
    };
  } catch (error) {
    context.error('GetTeam error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('GetTeam', {
  methods: ['GET'],
  route: 'staff/teams/{teamId}',
  authLevel: 'anonymous',
  handler: GetTeamHandler,
});

