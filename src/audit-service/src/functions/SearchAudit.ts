/**
 * Search Audit Handler
 * POST /api/audit/search
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { searchAuditLogs } from '../lib/auditRepository';
import { getConfig } from '../lib/config';
import { SearchAuditRequest } from '../models/AuditLog';

export async function SearchAuditHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('SearchAudit function processing request');

  try {
    // TODO: Add permission check for audit:read

    // Parse request body
    const body = await request.json() as SearchAuditRequest;

    // Validate required fields
    if (!body.startDate) {
      return {
        status: 400,
        jsonBody: { error: 'startDate is required' },
      };
    }

    if (!body.endDate) {
      return {
        status: 400,
        jsonBody: { error: 'endDate is required' },
      };
    }

    // Validate date range
    const config = getConfig();
    const startDate = new Date(body.startDate);
    const endDate = new Date(body.endDate);
    
    if (isNaN(startDate.getTime())) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid startDate format' },
      };
    }

    if (isNaN(endDate.getTime())) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid endDate format' },
      };
    }

    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > config.query.maxDateRangeDays) {
      return {
        status: 400,
        jsonBody: { 
          error: `Date range cannot exceed ${config.query.maxDateRangeDays} days`,
          maxDays: config.query.maxDateRangeDays,
        },
      };
    }

    if (daysDiff < 0) {
      return {
        status: 400,
        jsonBody: { error: 'endDate must be after startDate' },
      };
    }

    // Apply limit
    const limit = body.limit 
      ? Math.min(body.limit, config.query.maxLimit)
      : config.query.defaultLimit;

    // Search audit logs
    const result = await searchAuditLogs({
      ...body,
      limit,
    });

    return {
      status: 200,
      jsonBody: {
        ...result,
        filters: {
          startDate: body.startDate,
          endDate: body.endDate,
          ...body.filters,
        },
      },
    };
  } catch (error) {
    context.error('SearchAudit error:', error);

    if (error instanceof Error && error.message.includes('Date range')) {
      return {
        status: 400,
        jsonBody: { error: error.message },
      };
    }

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('SearchAudit', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'audit/search',
  handler: SearchAuditHandler,
});

