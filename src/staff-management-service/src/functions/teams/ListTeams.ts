/**
 * ListTeams Handler - GET /api/staff/teams
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listTeams } from '../../lib/teamRepository';
import { TeamListQuery, TeamType } from '../../models/Team';

export async function ListTeamsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('ListTeams invoked');

  try {
    // Parse query parameters
    const isActiveParam = request.query.get('isActive');
    const query: TeamListQuery = {
      type: (request.query.get('type') as TeamType) || undefined,
      territory: request.query.get('territory') || undefined,
      isActive: isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined,
      limit: parseInt(request.query.get('limit') || '50', 10),
      offset: parseInt(request.query.get('offset') || '0', 10),
    };

    // Get teams list
    const result = await listTeams(query);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('ListTeams error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('ListTeams', {
  methods: ['GET'],
  route: 'staff/teams',
  authLevel: 'anonymous',
  handler: ListTeamsHandler,
});

