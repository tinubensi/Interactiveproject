/**
 * DeleteStaff Handler - DELETE /api/staff/{staffId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById, deleteStaff } from '../../lib/staffRepository';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';

export async function DeleteStaffHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('DeleteStaff invoked');

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

    // Check if already deleted
    if (existing.deletedAt) {
      return {
        status: 410,
        jsonBody: {
          error: 'Gone',
          message: 'Staff member already deleted',
          deletedAt: existing.deletedAt,
        },
      };
    }

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Soft delete staff member
    const deleted = await deleteStaff(staffId, userId);

    // Publish event
    await publishStaffEvent(STAFF_EVENTS.STAFF_DELETED, deleted.staffId, {
      email: deleted.email,
      displayName: deleted.displayName,
      staffType: deleted.staffType,
      deletedBy: userId,
      deletedAt: deleted.deletedAt,
    });

    return {
      status: 200,
      jsonBody: {
        message: 'Staff member deleted successfully',
        staffId: deleted.staffId,
        deletedAt: deleted.deletedAt,
      },
    };
  } catch (error) {
    context.error('DeleteStaff error:', error);
    
    // Handle specific error messages
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
      if (error.message.includes('already deleted')) {
        return {
          status: 410,
          jsonBody: {
            error: 'Gone',
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

app.http('DeleteStaff', {
  methods: ['DELETE'],
  route: 'staff/{staffId}',
  authLevel: 'anonymous',
  handler: DeleteStaffHandler,
});
