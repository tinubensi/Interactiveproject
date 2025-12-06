/**
 * GetStaff Handler - GET /api/staff/{staffId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById } from '../../lib/staffRepository';
import { getWorkloadInfo } from '../../lib/workloadService';

export async function GetStaffHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetStaff invoked');

  try {
    const staffId = request.params.staffId;

    if (!staffId) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Staff ID is required',
        },
      };
    }

    const staff = await findStaffById(staffId);

    if (!staff) {
      return {
        status: 404,
        jsonBody: {
          error: 'Not Found',
          message: `Staff member "${staffId}" not found`,
        },
      };
    }

    // Get workload info
    const workloadInfo = getWorkloadInfo(staff);

    return {
      status: 200,
      jsonBody: {
        ...staff,
        workloadDetails: workloadInfo,
      },
    };
  } catch (error) {
    context.error('GetStaff error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('GetStaff', {
  methods: ['GET'],
  route: 'staff/{staffId}',
  authLevel: 'anonymous',
  handler: GetStaffHandler,
});

