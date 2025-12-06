/**
 * GetStaffPerformance Handler - GET /api/staff/{staffId}/performance
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { findStaffById } from '../../lib/staffRepository';
import { calculatePerformanceScore } from '../../lib/assignmentEngine';

export async function GetStaffPerformanceHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetStaffPerformance invoked');

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

    // Get period from query
    const period = request.query.get('period') || 'month';

    // Calculate performance metrics
    const performanceScore = calculatePerformanceScore(staff);

    // Get performance data or defaults
    const performance = staff.performance || {
      period: new Date().toISOString().slice(0, 7),
      leadsReceived: 0,
      leadsConverted: 0,
      policiesIssued: 0,
      premiumGenerated: 0,
    };

    const metrics = {
      leadsReceived: performance.leadsReceived || 0,
      leadsConverted: performance.leadsConverted,
      conversionRate: performance.leadsReceived
        ? performance.leadsConverted / performance.leadsReceived
        : 0,
      policiesIssued: performance.policiesIssued,
      premiumGenerated: performance.premiumGenerated,
      averageTransactionValue: performance.policiesIssued
        ? performance.premiumGenerated / performance.policiesIssued
        : 0,
      customerSatisfaction: performance.customerSatisfaction,
      averageResponseTime: performance.averageResponseTime,
      performanceScore,
    };

    return {
      status: 200,
      jsonBody: {
        staffId: staff.staffId,
        period: performance.period,
        metrics,
        // Comparison data would be calculated from historical data
        comparison: {
          vsPreviousPeriod: {
            conversionRate: 'N/A',
            premiumGenerated: 'N/A',
          },
          vsTeamAverage: {
            conversionRate: 'N/A',
            premiumGenerated: 'N/A',
          },
        },
        // Ranking would be calculated from team/company data
        ranking: {
          teamRank: null,
          teamSize: null,
          companyRank: null,
          companySize: null,
        },
      },
    };
  } catch (error) {
    context.error('GetStaffPerformance error:', error);
    return {
      status: 500,
      jsonBody: {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

app.http('GetStaffPerformance', {
  methods: ['GET'],
  route: 'staff/{staffId}/performance',
  authLevel: 'anonymous',
  handler: GetStaffPerformanceHandler,
});

