/**
 * FindStaffForAssignment Handler - POST /api/staff/auto-assign
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listStaff } from '../../lib/staffRepository';
import { listTeams } from '../../lib/teamRepository';
import { findBestStaffForAssignment, AssignmentCriteria } from '../../lib/assignmentEngine';

export async function FindStaffForAssignmentHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('FindStaffForAssignment invoked');

  try {
    // Parse request body
    const body = await request.json() as AssignmentCriteria;

    // Validate required fields
    if (!body.assignmentType) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Assignment type is required',
        },
      };
    }

    if (!body.territory) {
      return {
        status: 400,
        jsonBody: {
          error: 'Validation Error',
          message: 'Territory is required',
        },
      };
    }

    // Get all active staff
    const staffResult = await listStaff({ status: 'active', limit: 100 });

    // Get all active teams
    const teamsResult = await listTeams({ isActive: true, limit: 100 });

    // Convert list results to full documents
    // Note: For a production system, we'd want to fetch full documents
    // For now, we'll use the summary data
    const staffList = staffResult.staff.map((s) => ({
      id: s.staffId,
      staffId: s.staffId,
      azureAdId: '',
      email: s.email,
      firstName: '',
      lastName: '',
      displayName: s.displayName,
      phone: '',
      employeeId: '',
      jobTitle: '',
      department: '',
      staffType: s.staffType,
      hireDate: '',
      status: s.status,
      statusChangedAt: '',
      teamIds: s.teamIds,
      organizationId: 'default',
      territories: s.territories,
      workload: s.workload,
      availability: { isAvailable: true },
      notificationPreferences: {
        email: true,
        sms: false,
        push: true,
        channels: {
          approvals: true,
          assignments: true,
          alerts: true,
          marketing: false,
        },
      },
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
    }));

    const teamsList = teamsResult.teams.map((t) => ({
      id: t.teamId,
      teamId: t.teamId,
      name: t.name,
      type: t.type,
      leaderId: t.leaderId,
      leaderEmail: t.leaderEmail,
      memberIds: [],
      memberCount: t.memberCount,
      territories: t.territories,
      organizationId: 'default',
      isActive: t.isActive,
      createdAt: '',
      createdBy: '',
      updatedAt: '',
      updatedBy: '',
    }));

    // Find best staff
    const result = findBestStaffForAssignment(staffList, teamsList, body, 5);

    return {
      status: 200,
      jsonBody: result,
    };
  } catch (error) {
    context.error('FindStaffForAssignment error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('FindStaffForAssignment', {
  methods: ['POST'],
  route: 'staff/auto-assign',
  authLevel: 'anonymous',
  handler: FindStaffForAssignmentHandler,
});

