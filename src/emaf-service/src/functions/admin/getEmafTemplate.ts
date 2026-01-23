/**
 * Get EMAF Template
 * GET /api/admin/emaf/templates/{vendorId}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function getEmafTemplate(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_VIEW);
    
    const vendorId = request.params.vendorId;
    
    if (!vendorId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'vendorId is required'
        }
      });
    }
    
    const template = await cosmosService.getEmafTemplateByVendor(vendorId);
    
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: `No EMAF template found for vendor ${vendorId}`
        }
      });
    }
    
    // Regenerate SAS URL if vendor PDF exists (valid for 7 days)
    if (template.vendorPdfBlobPath) {
      try {
        const freshSasUrl = await blobService.generateDownloadSasUri(
          template.vendorPdfBlobPath,
          7 * 24 * 60 // 7 days in minutes
        );
        template.vendorPdfSasUrl = freshSasUrl;
        context.log(`Regenerated SAS URL for vendor PDF: ${template.vendorPdfBlobPath}`);
      } catch (sasError: any) {
        context.warn(`Failed to regenerate SAS URL for vendor PDF: ${sasError.message}`);
        // Continue anyway - client might have cached URL
      }
    }
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: template
      }
    });
  } catch (error: any) {
    context.error('Get EMAF template error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to get EMAF template',
        details: error.message
      }
    });
  }
}

app.http('getEmafTemplate', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates/{vendorId}',
  handler: getEmafTemplate
});
