/**
 * Get Export Status Handler
 * GET /api/audit/export/{exportId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getExportsContainer } from '../lib/cosmosClient';
import { AuditExportDocument, ExportStatusResponse } from '../models/AuditExport';

export async function GetExportStatusHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('GetExportStatus function processing request');

  try {
    // TODO: Add permission check for audit:export

    const exportId = request.params.exportId;

    if (!exportId) {
      return {
        status: 400,
        jsonBody: { error: 'exportId parameter is required' },
      };
    }

    // Get export document
    const container = getExportsContainer();
    
    try {
      const { resource } = await container.item(exportId, exportId).read<AuditExportDocument>();
      
      if (!resource) {
        return {
          status: 404,
          jsonBody: { error: `Export "${exportId}" not found` },
        };
      }

      const response: ExportStatusResponse = {
        exportId: resource.exportId,
        status: resource.status,
        format: resource.request.format,
        progress: resource.progress,
      };

      // Add result info if complete
      if (resource.status === 'complete' && resource.result) {
        response.recordCount = resource.result.recordCount;
        response.fileSize = resource.result.fileSize;
        response.downloadUrl = resource.result.blobUrl;
        response.expiresAt = resource.result.expiresAt;
      }

      // Add error info if failed
      if (resource.status === 'failed' && resource.error) {
        response.error = resource.error;
      }

      return {
        status: 200,
        jsonBody: response,
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        return {
          status: 404,
          jsonBody: { error: `Export "${exportId}" not found` },
        };
      }
      throw error;
    }
  } catch (error) {
    context.error('GetExportStatus error:', error);

    return {
      status: 500,
      jsonBody: { error: 'Internal server error' },
    };
  }
}

app.http('GetExportStatus', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'audit/export/{exportId}',
  handler: GetExportStatusHandler,
});

