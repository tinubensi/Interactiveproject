/**
 * Upload Signed PDF (Customer)
 * POST /api/customer/emaf/{submissionId}/signed-pdf
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { isFileSizeValid, sanitizeFileName } from '../../lib/validation';

export async function uploadSignedPdf(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.submissionId;
    
    if (!submissionId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'submissionId is required'
        }
      });
    }
    
    const submission = await cosmosService.getSubmissionById(submissionId);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Submission not found'
        }
      });
    }
    
    // Parse multipart form data (simplified - in production use proper multipart parser)
    const contentType = request.headers.get('content-type') || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Content-Type must be multipart/form-data'
        }
      });
    }
    
    // For now, get the body as buffer (simplified implementation)
    // In production, use formidable or similar library
    const buffer = Buffer.from(await request.arrayBuffer());
    
    // Validate file size (10MB max for signed PDF)
    if (!isFileSizeValid(buffer.length, 10)) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'File size exceeds 10MB limit'
        }
      });
    }
    
    // Upload to blob storage
    const fileName = `signed-${submission.submissionId}.pdf`;
    const blobPath = `emaf-pdfs/${submission.leadId}/${submissionId}/${sanitizeFileName(fileName)}`;
    
    await blobService.uploadPdf(blobPath, buffer);
    
    // Generate SAS URL (valid 30 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 30 * 24 * 60);
    
    // Update submission
    const updated = await cosmosService.updateSubmission(submissionId, submission.leadId, {
      signedPdfBlobPath: blobPath,
      signedPdfSasUrl: sasUrl,
      signedPdfUploadedAt: new Date(),
      status: 'pending_signature',
      updatedAt: new Date()
    });
    
    context.log(`Uploaded signed PDF for submission ${submissionId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Signed PDF uploaded successfully',
        data: {
          blobPath,
          uploadedAt: updated.signedPdfUploadedAt
        }
      }
    });
  } catch (error: any) {
    context.error('Upload signed PDF error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to upload signed PDF',
        details: error.message
      }
    });
  }
}

app.http('uploadSignedPdf', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/signed-pdf',
  handler: uploadSignedPdf
});
