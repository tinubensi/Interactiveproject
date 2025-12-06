/**
 * Create Export Handler
 * POST /api/audit/export
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { getExportsContainer } from '../lib/cosmosClient';
import { countByDateRange } from '../lib/auditRepository';
import { getConfig, TTL } from '../lib/config';
import { 
  AuditExportDocument, 
  CreateExportRequest, 
  CreateExportResponse 
} from '../models/AuditExport';

export async function CreateExportHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('CreateExport function processing request');

  try {
    // TODO: Add permission check for audit:export

    const userId = request.headers.get('x-user-id') || 'system';

    // Parse request body
    const body = await request.json() as CreateExportRequest;

    // Validate required fields
    if (!body.format) {
      return {
        status: 400,
        jsonBody: { error: 'format is required (pdf or csv)' },
      };
    }

    if (!['pdf', 'csv'].includes(body.format)) {
      return {
        status: 400,
        jsonBody: { error: 'format must be pdf or csv' },
      };
    }

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
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        status: 400,
        jsonBody: { error: 'Invalid date format' },
      };
    }

    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

    if (daysDiff > config.query.maxDateRangeDays) {
      return {
        status: 400,
        jsonBody: { 
          error: `Date range cannot exceed ${config.query.maxDateRangeDays} days`,
        },
      };
    }

    // Estimate record count
    const estimatedRecords = await countByDateRange(
      body.startDate,
      body.endDate,
      body.filters
    );

    if (estimatedRecords > config.export.maxRecords) {
      return {
        status: 400,
        jsonBody: { 
          error: `Export cannot exceed ${config.export.maxRecords} records. Found approximately ${estimatedRecords} records.`,
          estimatedRecords,
          maxRecords: config.export.maxRecords,
        },
      };
    }

    // Create export document
    const exportId = uuidv4();
    const now = new Date().toISOString();

    const exportDoc: AuditExportDocument = {
      id: exportId,
      exportId,
      status: 'pending',
      request: {
        format: body.format,
        startDate: body.startDate,
        endDate: body.endDate,
        filters: body.filters || {},
        includeDetails: body.includeDetails ?? true,
        requestedBy: userId,
      },
      progress: 0,
      createdAt: now,
      ttl: TTL.EXPORTS,
    };

    const container = getExportsContainer();
    await container.items.create(exportDoc);

    // TODO: Trigger background export job via queue message

    const response: CreateExportResponse = {
      exportId,
      status: 'processing',
      estimatedRecords,
      checkStatusUrl: `/api/audit/export/${exportId}`,
    };

    return {
      status: 202,
      jsonBody: response,
    };
  } catch (error) {
    context.error('CreateExport error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('CreateExport', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'audit/export',
  handler: CreateExportHandler,
});

