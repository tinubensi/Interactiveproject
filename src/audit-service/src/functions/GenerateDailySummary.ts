/**
 * Generate Daily Summary Handler
 * Timer Trigger - Runs at 00:05 UTC daily
 */

import { app, Timer, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getLogsContainer, getSummariesContainer } from '../lib/cosmosClient';
import { TTL } from '../lib/config';
import { AuditLogDocument, AuditCategory } from '../models/AuditLog';
import { AuditSummaryDocument, TopActor, SecurityEventsSummary, AuditTotals } from '../models/AuditSummary';

/**
 * Get yesterday's date in YYYY-MM-DD format
 */
function getYesterdayDate(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return yesterday.toISOString().split('T')[0];
}

/**
 * Aggregate audit logs for a given date
 */
async function aggregateLogsForDate(date: string): Promise<{
  totals: AuditTotals;
  topActors: TopActor[];
  securityEvents: SecurityEventsSummary;
}> {
  const container = getLogsContainer();
  const startDate = `${date}T00:00:00Z`;
  const endDate = `${date}T23:59:59Z`;

  // Initialize aggregation structures
  const totals: AuditTotals = {
    totalEvents: 0,
    byCategory: {} as Record<AuditCategory, number>,
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

  // Query logs for the date
  const querySpec = {
    query: `SELECT * FROM c WHERE c.timestamp >= @startDate AND c.timestamp <= @endDate`,
    parameters: [
      { name: '@startDate', value: startDate },
      { name: '@endDate', value: endDate },
    ],
  };

  let continuationToken: string | undefined;

  do {
    const options: { maxItemCount: number; continuationToken?: string } = {
      maxItemCount: 1000,
    };

    if (continuationToken) {
      options.continuationToken = continuationToken;
    }

    const { resources, continuationToken: nextToken } = await container.items
      .query<AuditLogDocument>(querySpec, options)
      .fetchNext();

    continuationToken = nextToken || undefined;

    for (const log of resources) {
      totals.totalEvents++;

      // Count by category
      (totals.byCategory as Record<string, number>)[log.category] = 
        ((totals.byCategory as Record<string, number>)[log.category] || 0) + 1;

      // Count by action
      totals.byAction[log.action] = (totals.byAction[log.action] || 0) + 1;

      // Count by severity
      totals.bySeverity[log.severity] = (totals.bySeverity[log.severity] || 0) + 1;

      // Count by entity type
      totals.byEntityType[log.entityType] = (totals.byEntityType[log.entityType] || 0) + 1;

      // Count by actor
      if (log.actor.id !== 'system') {
        const existing = actorCounts.get(log.actor.id);
        if (existing) {
          existing.count++;
        } else {
          actorCounts.set(log.actor.id, { email: log.actor.email, count: 1 });
        }
      }

      // Count security events
      if (log.action === 'login_failed' || log.action === 'failed') {
        securityEvents.failedLogins++;
      }
      if (log.action === 'denied' || log.category === 'security_event') {
        if (log.action !== 'login_failed' && log.action !== 'failed') {
          securityEvents.permissionDenied++;
        }
      }
      if (log.severity === 'critical') {
        securityEvents.suspiciousActivity++;
      }
    }
  } while (continuationToken);

  // Get top 10 actors
  const topActors = Array.from(actorCounts.entries())
    .map(([userId, { email, count }]) => ({ userId, email, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return { totals, topActors, securityEvents };
}

export async function GenerateDailySummaryHandler(
  myTimer: Timer,
  context: InvocationContext
): Promise<void> {
  context.log('GenerateDailySummary function running at:', new Date().toISOString());

  try {
    const date = getYesterdayDate();
    context.log(`Generating summary for date: ${date}`);

    // Check if summary already exists
    const summariesContainer = getSummariesContainer();
    
    try {
      const { resources } = await summariesContainer.items
        .query<AuditSummaryDocument>({
          query: 'SELECT * FROM c WHERE c.date = @date',
          parameters: [{ name: '@date', value: date }],
        })
        .fetchAll();

      if (resources.length > 0) {
        context.log(`Summary for ${date} already exists, skipping`);
        return;
      }
    } catch {
      // Continue if query fails
    }

    // Aggregate logs
    const { totals, topActors, securityEvents } = await aggregateLogsForDate(date);

    // Create summary document
    const summary: AuditSummaryDocument = {
      id: uuidv4(),
      date,
      totals,
      topActors,
      securityEvents,
      generatedAt: new Date().toISOString(),
      ttl: TTL.SUMMARIES,
    };

    // Store summary
    await summariesContainer.items.create(summary);

    context.log(`Summary for ${date} created: ${totals.totalEvents} total events`);

    if (myTimer.isPastDue) {
      context.log('Timer is past due, catch-up run completed');
    }
  } catch (error) {
    context.error('GenerateDailySummary error:', error);
  }
}

app.timer('GenerateDailySummary', {
  // Run at 00:05 UTC daily
  schedule: '0 5 0 * * *',
  handler: GenerateDailySummaryHandler,
});

