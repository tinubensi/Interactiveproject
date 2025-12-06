/**
 * ListTerritories Handler - GET /api/staff/territories
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listTerritories } from '../../lib/territoryRepository';

export async function ListTerritoriesHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('ListTerritories invoked');

  try {
    const territories = await listTerritories();

    return {
      status: 200,
      jsonBody: {
        territories,
      },
    };
  } catch (error) {
    context.error('ListTerritories error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('ListTerritories', {
  methods: ['GET'],
  route: 'staff/territories',
  authLevel: 'anonymous',
  handler: ListTerritoriesHandler,
});

