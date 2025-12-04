/**
 * Get Stats Handler
 * GET /api/audit/stats
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getSummariesContainer } from '../lib/cosmosClient';
import { AuditSummaryDocument, AuditStatsResponse, AuditTotals, TopActor, SecurityEventsSummary } from '../models/AuditSummary';

type Period = 'day' | 'week' | 'month';

/**
 * Get date range for period
 */
function getDateRange(period: Period): { startDate: string; endDate: string } {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'day':
      // Today only
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

/**
 * Get dates between start and end
 */
function getDatesBetween(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

/**
 * Aggregate summaries
 */
function aggregateSummaries(summaries: AuditSummaryDocument[]): {
  totals: AuditTotals;
  topActors: TopActor[];
  securityEvents: SecurityEventsSummary;
} {
  const totals: AuditTotals = {
    totalEvents: 0,
    byCategory: {} as Record<string, number>,
    byAction: {} as Record<string, number>,
    bySeverity: {} as Record<string, number>,
    byEntityType: {} as Record<string, number>,
  };

  const actorCounts = new Map<string, { email: string; count: number }>();
  const securityEvents: SecurityEventsSummary = {
    failedLogins: 0,
    permissionDenied: 0,
    suspiciousActivity: 0,
  };

  for (const summary of summaries) {
    totals.totalEvents += summary.totals.totalEvents;

    // Aggregate by category
    for (const [category, count] of Object.entries(summary.totals.byCategory)) {
      (totals.byCategory as Record<string, number>)[category] = ((totals.byCategory as Record<string, number>)[category] || 0) + count;
    }

    // Aggregate by action
    for (const [action, count] of Object.entries(summary.totals.byAction)) {
      totals.byAction[action] = (totals.byAction[action] || 0) + count;
    }

    // Aggregate by severity
    for (const [severity, count] of Object.entries(summary.totals.bySeverity)) {
      totals.bySeverity[severity] = (totals.bySeverity[severity] || 0) + count;
    }

    // Aggregate by entity type
    for (const [entityType, count] of Object.entries(summary.totals.byEntityType)) {
      totals.byEntityType[entityType] = (totals.byEntityType[entityType] || 0) + count;
    }

    // Aggregate actors
    for (const actor of summary.topActors) {
      const existing = actorCounts.get(actor.userId);
      if (existing) {
        existing.count += actor.count;
      } else {
        actorCounts.set(actor.userId, { email: actor.email, count: actor.count });
      }
    }

    // Aggregate security events
    securityEvents.failedLogins += summary.securityEvents.failedLogins;
    securityEvents.permissionDenied += summary.securityEvents.permissionDenied;
    securityEvents.suspiciousActivity += summary.securityEvents.suspiciousActivity;
  }

  // Get top 10 actors
  const topActors = Array.from(actorCounts.entries())
    .map(([userId, { email, count }]) => ({ userId, email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { totals, topActors, securityEvents };
}

export async function GetStatsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetStats function processing request');

  try {
    // TODO: Add permission check for audit:read

    // Parse query parameters
    const periodParam = request.query.get('period') || 'day';
    const period = ['day', 'week', 'month'].includes(periodParam) 
      ? periodParam as Period 
      : 'day';

    const { startDate, endDate } = getDateRange(period);
    const dates = getDatesBetween(startDate, endDate);

    // Query summaries for the date range
    const container = getSummariesContainer();
    const placeholders = dates.map((_, i) => `@date${i}`).join(', ');
    const parameters = dates.map((date, i) => ({ name: `@date${i}`, value: date }));

    const { resources: summaries } = await container.items
      .query<AuditSummaryDocument>({
        query: `SELECT * FROM c WHERE c.date IN (${placeholders})`,
        parameters,
      })
      .fetchAll();

    // If no summaries, return empty stats
    if (summaries.length === 0) {
      const emptyResponse: AuditStatsResponse = {
        period,
        startDate,
        endDate,
        totals: {
          totalEvents: 0,
          byCategory: {} as Record<string, number>,
          byAction: {},
          bySeverity: {},
          byEntityType: {},
        },
        topActors: [],
        securityEvents: {
          failedLogins: 0,
          permissionDenied: 0,
          suspiciousActivity: 0,
        },
      };

      return {
        status: 200,
        jsonBody: emptyResponse,
      };
    }

    // Aggregate summaries
    const { totals, topActors, securityEvents } = aggregateSummaries(summaries);

    const response: AuditStatsResponse = {
      period,
      startDate,
      endDate,
      totals,
      topActors,
      securityEvents,
    };

    return {
      status: 200,
      jsonBody: response,
    };
  } catch (error) {
    context.error('GetStats error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetStats', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'audit/stats',
  handler: GetStatsHandler,
});

