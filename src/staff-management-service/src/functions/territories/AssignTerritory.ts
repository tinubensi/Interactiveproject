/**
 * AssignTerritory Handler - POST /api/staff/{staffId}/territories
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById, updateStaffTerritories } from '../../lib/staffRepository';
import { updateTerritoryStaffAssignment, findTerritoryById } from '../../lib/territoryRepository';
import { publishStaffEvent, STAFF_EVENTS } from '../../lib/eventPublisher';
import { AssignTerritoryRequest } from '../../models/Territory';

export async function AssignTerritoryHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('AssignTerritory invoked');

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

    // Parse request body
    const body = await request.json() as AssignTerritoryRequest;

    if (!body.territories || !Array.isArray(body.territories)) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Territories array is required',
        },
      };
    }

    if (!body.operation || !['add', 'remove', 'replace'].includes(body.operation)) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Operation must be "add", "remove", or "replace"',
        },
      };
    }

    // Validate territories exist
    for (const territoryId of body.territories) {
      const territory = await findTerritoryById(territoryId);
      if (!territory) {
        return {
          status: 400,
          jsonBody: {
            error: 'Validation Error',
            message: `Territory "${territoryId}" not found`,
          },
        };
      }
    }

    // Get user ID from headers
    const userId = request.headers.get('x-user-id') || 'system';

    const previousTerritories = [...staff.territories];
    let newTerritories: string[];

    // Calculate new territories based on operation
    switch (body.operation) {
      case 'add':
        newTerritories = [...new Set([...staff.territories, ...body.territories])];
        break;
      case 'remove':
        newTerritories = staff.territories.filter((t) => !body.territories.includes(t));
        break;
      case 'replace':
        newTerritories = body.territories;
        break;
      default:
        newTerritories = staff.territories;
    }

    // Update staff territories
    await updateStaffTerritories(staffId, newTerritories, userId);

    // Update territory assignments
    const addedTerritories = newTerritories.filter((t) => !previousTerritories.includes(t));
    const removedTerritories = previousTerritories.filter((t) => !newTerritories.includes(t));

    for (const territoryId of addedTerritories) {
      await updateTerritoryStaffAssignment(territoryId, staffId, 'add');
    }
    for (const territoryId of removedTerritories) {
      await updateTerritoryStaffAssignment(territoryId, staffId, 'remove');
    }

    // Publish event
    await publishStaffEvent(STAFF_EVENTS.STAFF_TERRITORY_ASSIGNED, staffId, {
      email: staff.email,
      displayName: staff.displayName,
      previousTerritories,
      currentTerritories: newTerritories,
      operation: body.operation,
      updatedBy: userId,
    });

    return {
      status: 200,
      jsonBody: {
        staffId,
        previousTerritories,
        currentTerritories: newTerritories,
        updatedAt: new Date().toISOString(),
      },
    };
  } catch (error) {
    context.error('AssignTerritory error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('AssignTerritory', {
  methods: ['POST'],
  route: 'staff/{staffId}/territories',
  authLevel: 'anonymous',
  handler: AssignTerritoryHandler,
});

