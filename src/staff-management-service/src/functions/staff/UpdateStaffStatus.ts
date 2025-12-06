/**
 * UpdateStaffStatus Handler - PATCH /api/staff/{staffId}/status
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById, updateStaffStatus } from '../../lib/staffRepository';
import { applyStatusChange } from '../../lib/statusService';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';
import { UpdateStaffStatusRequest } from '../../models/StaffMember';

export async function UpdateStaffStatusHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('UpdateStaffStatus invoked');

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
    const body = await request.json() as UpdateStaffStatusRequest;

    if (!body.status) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Status is required',
        },
      };
    }

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Validate and calculate status change
    let statusChange;
    try {
      statusChange = applyStatusChange(existing, body.status, body.reason, body.awayUntil);
    } catch (error) {
      return {
        status: 400,
        jsonBody: {
          error: 'Invalid Status Transition',
          message: error instanceof Error ? error.message : 'Invalid status transition',
        },
      };
    }

    // Update staff status
    const updated = await updateStaffStatus(
      staffId,
      statusChange.currentStatus,
      statusChange.availability,
      statusChange.reason,
      userId
    );

    // Publish event based on status
    const eventType = statusChange.currentStatus === 'active'
      ? STAFF_EVENTS.STAFF_ACTIVATED
      : STAFF_EVENTS.STAFF_DEACTIVATED;

    await publishStaffEvent(eventType, updated.staffId, {
      email: updated.email,
      displayName: updated.displayName,
      previousStatus: statusChange.previousStatus,
      currentStatus: statusChange.currentStatus,
      reason: statusChange.reason,
      updatedBy: userId,
    });

    return {
      status: 200,
      jsonBody: {
        staffId: updated.staffId,
        previousStatus: statusChange.previousStatus,
        currentStatus: statusChange.currentStatus,
        reason: statusChange.reason,
        awayUntil: statusChange.availability.awayUntil,
        statusChangedAt: statusChange.statusChangedAt,
      },
    };
  } catch (error) {
    context.error('UpdateStaffStatus error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('UpdateStaffStatus', {
  methods: ['PATCH'],
  route: 'staff/{staffId}/status',
  authLevel: 'anonymous',
  handler: UpdateStaffStatusHandler,
});

