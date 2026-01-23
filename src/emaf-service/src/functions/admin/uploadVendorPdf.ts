/**
 * Upload Vendor PDF Endpoint
 * POST /api/manage/templates/{id}/upload-pdf
 * Accepts multipart form data with PDF file
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { blobService } from '../../services/blobService';
import { cosmosService } from '../../services/cosmosService';
import { pdfParserService } from '../../services/pdfParserService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { withCors, handlePreflight } from '../../lib/corsHelper';

export async function uploadVendorPdf(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_CREATE);

    const templateId = request.params.id;
    const vendorId = request.query.get('vendorId');

    if (!templateId || !vendorId) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Template ID and Vendor ID are required'
        }
      });
    }

    // Get existing template
    const template = await cosmosService.getEmafTemplateById(templateId, vendorId);
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: {
          success: false,
          error: 'EMAF template not found'
        }
      });
    }

    // Get multipart form data
    const formData = await request.formData();
    const pdfFile = formData.get('file') as File;

    if (!pdfFile) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'No PDF file provided'
        }
      });
    }

    // Validate file type
    if (pdfFile.type !== 'application/pdf') {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'Invalid file type. Only PDF files are accepted'
        }
      });
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (pdfFile.size > maxSize) {
      return withCors(request, {
        status: 400,
        jsonBody: {
          success: false,
          error: 'File size exceeds maximum limit of 50MB'
        }
      });
    }

    context.log(`Uploading vendor PDF for template ${templateId}, file: ${pdfFile.name}`);

    // Convert File to Buffer
    const arrayBuffer = await pdfFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get PDF metadata
    const metadata = await pdfParserService.getPdfMetadata(buffer);
    context.log(`PDF metadata: ${metadata.pageCount} pages`);

    // Upload to blob storage
    const blobPath = `vendor-pdfs/${vendorId}/${templateId}/original.pdf`;
    await blobService.uploadPdf(blobPath, buffer);

    context.log(`PDF uploaded to blob: ${blobPath}`);

    // Generate SAS URL (valid for 365 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 365 * 24 * 60);

    // Update template with PDF info
    await cosmosService.updateEmafTemplate(templateId, vendorId, {
      vendorPdfBlobPath: blobPath,
      vendorPdfSasUrl: sasUrl,
      vendorPdfUploadedAt: new Date(),
      vendorPdfFileName: pdfFile.name,
      vendorPdfPageCount: metadata.pageCount,
      updatedAt: new Date(),
      updatedBy: userContext.userId
    });

    context.log('Template updated with vendor PDF information');

    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        message: 'Vendor PDF uploaded successfully',
        data: {
          blobPath,
          sasUrl,
          fileName: pdfFile.name,
          pageCount: metadata.pageCount
        }
      }
    });
  } catch (error: any) {
    context.error('Upload vendor PDF error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to upload PDF',
        details: error.message
      }
    });
  }
}

app.http('uploadVendorPdf', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/templates/{id}/upload-pdf',
  handler: uploadVendorPdf
});
