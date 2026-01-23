/**
 * Refresh SAS URLs for Submission (Staff)
 * POST /api/emaf/submissions/details/{id}/refresh-sas
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function refreshSubmissionSas(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.id;
    
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
    
    // Refresh SAS URLs with 24 hour expiry for staff review
    const expiryHours = 24;
    
    // Refresh signed PDF SAS URL
    if (submission.signedPdfBlobPath) {
      submission.signedPdfSasUrl = await blobService.generateDownloadSasUri(
        submission.signedPdfBlobPath,
        expiryHours * 60
      );
    }
    
    // Refresh document SAS URLs
    if (submission.uploadedDocuments && submission.uploadedDocuments.length > 0) {
      for (const doc of submission.uploadedDocuments) {
        if (doc.blobPath) {
          doc.sasUrl = await blobService.generateDownloadSasUri(
            doc.blobPath,
            expiryHours * 60
          );
        }
      }
    }
    
    // Update submission with new SAS URLs
    await cosmosService.updateSubmission(submission.id, submission.leadId, {
      signedPdfSasUrl: submission.signedPdfSasUrl,
      uploadedDocuments: submission.uploadedDocuments,
    });
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: submission,
        message: `SAS URLs refreshed successfully. Valid for ${expiryHours} hours.`
      }
    });
  } catch (error: any) {
    context.error('Refresh SAS URLs error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to refresh SAS URLs',
        details: error.message
      }
    });
  }
}

app.http('refreshSubmissionSas', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'emaf/submissions/details/{id}/refresh-sas',
  handler: refreshSubmissionSas
});
