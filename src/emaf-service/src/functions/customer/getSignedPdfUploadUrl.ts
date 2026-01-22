/**
 * Get Signed PDF Upload URL (Customer)
 * POST /api/customer/emaf/{token}/upload-signed-pdf
 * Returns a SAS URL for direct blob upload of signed PDF
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { sanitizeFileName } from '../../lib/validation';

export async function getSignedPdfUploadUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    const body = await request.json() as any;
    
    const { fileName } = body;
    
    if (!token || !fileName) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'token and fileName are required'
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
    
    // Generate blob path
    const sanitizedFileName = sanitizeFileName(fileName);
    const blobPath = `emaf-pdfs/${submission.leadId}/${token}/signed-${sanitizedFileName}`;
    
    // Generate SAS URL for upload (valid for 1 hour)
    const sasUrl = await blobService.generateUploadSasUri(blobPath, 60);
    
    context.log(`Generated signed PDF upload URL for submission ${token}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        uploadUrl: sasUrl,
        blobPath: blobPath
      }
    });
  } catch (error: any) {
    context.error('Get signed PDF upload URL error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to generate upload URL',
        details: error.message
      }
    });
  }
}

app.http('getSignedPdfUploadUrl', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/upload-signed-pdf',
  handler: getSignedPdfUploadUrl
});
