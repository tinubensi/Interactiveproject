/**
 * GetStaffByEmail Handler - GET /api/staff/by-email/{email}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffByEmail } from '../../lib/staffRepository';

export async function GetStaffByEmailHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetStaffByEmail invoked');

  try {
    const email = request.params.email;

    if (!email) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Email is required',
        },
      };
    }

    const decodedEmail = decodeURIComponent(email);
    const staff = await findStaffByEmail(decodedEmail);

    if (!staff) {
      return {
        status: 404,
        jsonBody: {
          error: 'Not Found',
          message: `Staff member with email "${decodedEmail}" not found`,
        },
      };
    }

    return {
      status: 200,
      jsonBody: staff,
    };
  } catch (error) {
    context.error('GetStaffByEmail error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('GetStaffByEmail', {
  methods: ['GET'],
  route: 'staff/by-email/{email}',
  authLevel: 'anonymous',
  handler: GetStaffByEmailHandler,
});

