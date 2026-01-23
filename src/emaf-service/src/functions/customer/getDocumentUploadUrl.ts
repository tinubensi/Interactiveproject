/**
 * Get Document Upload URL (Customer)
 * POST /api/customer/emaf/{token}/upload-url
 * Returns a SAS URL for direct blob upload
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { sanitizeFileName } from '../../lib/validation';
import { v4 as uuidv4 } from 'uuid';

export async function getDocumentUploadUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    const body = await request.json() as any;
    
    const { fileName, documentType, documentRequirementId, mimeType } = body;
    
    if (!token || !fileName || !documentType) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'token, fileName, and documentType are required'
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
    
    // Generate unique document ID and blob path
    const docId = uuidv4();
    const sanitizedFileName = sanitizeFileName(fileName);
    const blobPath = `emaf-documents/${submission.leadId}/${token}/${docId}/${sanitizedFileName}`;
    
    // Generate SAS URL for upload (valid for 1 hour)
    const sasUrl = await blobService.generateUploadSasUri(blobPath, 60);
    
    context.log(`Generated upload URL for submission ${token}, document ${docId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        uploadUrl: sasUrl,
        blobPath: blobPath,
        documentId: docId,
        metadata: {
          documentRequirementId,
          documentType,
          fileName: sanitizedFileName,
          mimeType: mimeType || 'application/octet-stream'
        }
      }
    });
  } catch (error: any) {
    context.error('Get document upload URL error:', error);
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

app.http('getDocumentUploadUrl', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/upload-url',
  handler: getDocumentUploadUrl
});
