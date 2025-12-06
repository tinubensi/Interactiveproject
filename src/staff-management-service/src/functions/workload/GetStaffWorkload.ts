/**
 * GetStaffWorkload Handler - GET /api/staff/{staffId}/workload
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById } from '../../lib/staffRepository';
import { getWorkloadInfo } from '../../lib/workloadService';

export async function GetStaffWorkloadHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetStaffWorkload invoked');

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
        staffId: staff.staffId,
        workload: workloadInfo.workload,
        breakdown: workloadInfo.breakdown,
        availability: workloadInfo.availability,
      },
    };
  } catch (error) {
    context.error('GetStaffWorkload error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('GetStaffWorkload', {
  methods: ['GET'],
  route: 'staff/{staffId}/workload',
  authLevel: 'anonymous',
  handler: GetStaffWorkloadHandler,
});

