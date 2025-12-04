/**
 * ListStaff Handler - GET /api/staff
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listStaff } from '../../lib/staffRepository';
import { StaffListQuery, StaffType, StaffStatus } from '../../models/StaffMember';

export async function ListStaffHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('ListStaff invoked');

  try {
    // Parse query parameters
    const query: StaffListQuery = {
      teamId: request.query.get('teamId') || undefined,
      territory: request.query.get('territory') || undefined,
      staffType: (request.query.get('staffType') as StaffType) || undefined,
      status: (request.query.get('status') as StaffStatus) || undefined,
      search: request.query.get('search') || undefined,
      limit: parseInt(request.query.get('limit') || '50', 10),
      offset: parseInt(request.query.get('offset') || '0', 10),
    };

    // Validate limit
    if (query.limit && (query.limit < 1 || query.limit > 100)) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Limit must be between 1 and 100',
        },
      };
    }

    // Get staff list
    const result = await listStaff(query);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('ListStaff error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('ListStaff', {
  methods: ['GET'],
  route: 'staff',
  authLevel: 'anonymous',
  handler: ListStaffHandler,
});

