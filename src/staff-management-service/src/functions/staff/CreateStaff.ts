/**
 * CreateStaff Handler - POST /api/staff
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { createStaff, findStaffByEmail } from '../../lib/staffRepository';
import { validateCreateStaffRequest } from '../../lib/validators';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';
import { CreateStaffRequest } from '../../models/StaffMember';

export async function CreateStaffHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateStaff invoked');

  try {
    // Parse request body
    const body = await request.json() as CreateStaffRequest;

    // Validate request
    const validation = validateCreateStaffRequest(body);
    if (!validation.valid) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          details: validation.errors,
        },
      };
    }

    // Check for unique email (only for non-deleted staff)
    const existingByEmail = await findStaffByEmail(body.email);
    if (existingByEmail && !existingByEmail.deletedAt) {
      return {
        status: 409,
        jsonBody: {
          error: 'Conflict',
          message: `Staff member with email "${body.email}" already exists`,
        },
      };
    }

    // Get user ID from headers (set by auth middleware)
    const userId = request.headers.get('x-user-id') || 'system';

    // Create staff member
    const staff = await createStaff(body, userId);

    // Publish event
    await publishStaffEvent(STAFF_EVENTS.STAFF_CREATED, staff.staffId, {
      email: staff.email,
      displayName: staff.displayName,
      staffType: staff.staffType,
      createdBy: userId,
    });

    return {
      status: 201,
      jsonBody: {
        staffId: staff.staffId,
        email: staff.email,
        displayName: staff.displayName,
        staffType: staff.staffType,
        createdAt: staff.createdAt,
      },
    };
  } catch (error) {
    context.error('CreateStaff error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('CreateStaff', {
  methods: ['POST'],
  route: 'staff',
  authLevel: 'anonymous',
  handler: CreateStaffHandler,
});

