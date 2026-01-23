/**
 * Confirm Signed PDF Upload (Customer)
 * POST /api/customer/emaf/{token}/confirm-signed-pdf
 * Called after frontend successfully uploads signed PDF to blob storage
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function confirmSignedPdfUpload(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    const body = await request.json() as any;
    
    const { blobPath, fileName, fileSize } = body;
    
    if (!token || !blobPath) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'token and blobPath are required'
        }
      });
    }
    
    // Get submission
    const submission = await cosmosService.getSubmissionById(token);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Submission not found'
        }
      });
    }
    
    // Verify blob exists
    const exists = await blobService.blobExists(blobPath);
    if (!exists) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Signed PDF not found in storage. Please upload again.'
        }
      });
    }
    
    // Generate download SAS URL (valid 30 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 30 * 24 * 60);
    
    // Update submission
    const updated = await cosmosService.updateSubmission(token, submission.leadId, {
      signedPdfBlobPath: blobPath,
      signedPdfSasUrl: sasUrl,
      signedPdfUploadedAt: new Date(),
      updatedAt: new Date()
    });
    
    context.log(`Confirmed signed PDF upload for submission ${token}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Signed PDF uploaded successfully',
        data: {
          blobPath,
          sasUrl,
          fileName,
          uploadedAt: updated.signedPdfUploadedAt
        }
      }
    });
  } catch (error: any) {
    context.error('Confirm signed PDF upload error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to confirm signed PDF upload',
        details: error.message
      }
    });
  }
}

app.http('confirmSignedPdfUpload', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/confirm-signed-pdf',
  handler: confirmSignedPdfUpload
});
