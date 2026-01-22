/**
 * Confirm Document Upload (Customer)
 * POST /api/customer/emaf/{token}/confirm-upload
 * Called after frontend successfully uploads document to blob storage
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function confirmDocumentUpload(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    const body = await request.json() as any;
    
    const { 
      documentId, 
      blobPath, 
      fileName, 
      documentType, 
      documentRequirementId, 
      fileSize, 
      mimeType 
    } = body;
    
    if (!token || !documentId || !blobPath || !fileName || !documentType || !documentRequirementId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'token, documentId, blobPath, fileName, documentType, and documentRequirementId are required'
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
          error: 'Document not found in storage. Please upload again.'
        }
      });
    }
    
    // Generate download SAS URL (valid 30 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 30 * 24 * 60);
    
    // Add to uploaded documents
    const uploadedDoc = {
      id: documentId,
      documentRequirementId,
      documentType,
      fileName,
      blobPath,
      sasUrl,
      uploadedAt: new Date(),
      fileSize: fileSize || 0,
      mimeType: mimeType || 'application/octet-stream'
    };
    
    const updatedDocs = [...submission.uploadedDocuments, uploadedDoc];
    
    // Update submission
    const updated = await cosmosService.updateSubmission(token, submission.leadId, {
      uploadedDocuments: updatedDocs,
      updatedAt: new Date()
    });
    
    context.log(`Confirmed document upload ${documentId} for submission ${token}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Document uploaded successfully',
        data: uploadedDoc
      }
    });
  } catch (error: any) {
    context.error('Confirm document upload error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to confirm document upload',
        details: error.message
      }
    });
  }
}

app.http('confirmDocumentUpload', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/confirm-upload',
  handler: confirmDocumentUpload
});
