/**
 * ListStaff Handler - POST /api/staff
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
    // Parse request body
    const body = await request.json() as any;

    // Build list query with defaults
    const query: StaffListQuery = {
      page: body.page || 1,
      limit: body.limit || 10,
      sortBy: body.sortBy || 'displayName',
      sortOrder: body.sortOrder || 'asc',
      staffType: body.staffType as StaffType,
      status: body.status as StaffStatus,
      search: body.search,
      filters: body.filters,
    };

    // Validate page
    if (query.page && query.page < 1) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Page must be >= 1',
        },
      };
    }

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
  methods: ['POST'],
  route: 'staff/list',
  authLevel: 'anonymous',
  handler: ListStaffHandler,
});

