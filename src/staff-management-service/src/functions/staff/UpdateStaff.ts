/**
 * UpdateStaff Handler - PUT /api/staff/{staffId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById, updateStaff } from '../../lib/staffRepository';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';
import { UpdateStaffRequest } from '../../models/StaffMember';

export async function UpdateStaffHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('UpdateStaff invoked');

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

    // Check if staff exists
    const existing = await findStaffById(staffId);
    if (!existing) {
      return {
        status: 404,
        jsonBody: {
          error: 'Not Found',
          message: `Staff member "${staffId}" not found`,
        },
      };
    }

    // Parse request body
    const body = await request.json() as UpdateStaffRequest;

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Update staff member
    const updated = await updateStaff(staffId, body, userId);

    // Publish event
    await publishStaffEvent(STAFF_EVENTS.STAFF_UPDATED, updated.staffId, {
      email: updated.email,
      displayName: updated.displayName,
      staffType: updated.staffType,
      updatedBy: userId,
      changes: Object.keys(body),
    });

    return {
      status: 200,
      jsonBody: updated,
    };
  } catch (error) {
    context.error('UpdateStaff error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('UpdateStaff', {
  methods: ['PUT'],
  route: 'staff/{staffId}',
  authLevel: 'anonymous',
  handler: UpdateStaffHandler,
});

