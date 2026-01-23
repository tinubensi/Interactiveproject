/**
 * Upload Document (Customer)
 * POST /api/customer/emaf/{submissionId}/documents
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { isFileSizeValid, isFileTypeValid, sanitizeFileName } from '../../lib/validation';
import { v4 as uuidv4 } from 'uuid';

export async function uploadDocument(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.submissionId;
    const documentRequirementId = request.query.get('documentRequirementId');
    const documentType = request.query.get('documentType');
    const fileName = request.query.get('fileName');
    const mimeType = request.query.get('mimeType') || 'application/octet-stream';
    
    if (!submissionId || !documentRequirementId || !documentType || !fileName) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'submissionId, documentRequirementId, documentType, and fileName are required'
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
    
    // Get template to validate document requirement
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    const docReq = template?.requiredDocuments.find(d => d.id === documentRequirementId);
    
    if (!docReq) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Invalid document requirement'
        }
      });
    }
    
    // Get file buffer
    const buffer = Buffer.from(await request.arrayBuffer());
    
    // Validate file size
    if (!isFileSizeValid(buffer.length, docReq.maxSizeInMB)) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: `File size exceeds ${docReq.maxSizeInMB}MB limit`
        }
      });
    }
    
    // Validate file type
    if (!isFileTypeValid(fileName, docReq.acceptedFormats)) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: `File type not accepted. Accepted formats: ${docReq.acceptedFormats.join(', ')}`
        }
      });
    }
    
    // Upload to blob storage
    const docId = uuidv4();
    const sanitizedFileName = sanitizeFileName(fileName);
    const blobPath = `emaf-documents/${submission.leadId}/${submissionId}/${docId}/${sanitizedFileName}`;
    
    await blobService.uploadDocument(blobPath, buffer, mimeType);
    
    // Generate SAS URL (valid 30 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 30 * 24 * 60);
    
    // Add to uploaded documents
    const uploadedDoc = {
      id: docId,
      documentRequirementId,
      documentType,
      fileName: sanitizedFileName,
      blobPath,
      sasUrl,
      uploadedAt: new Date(),
      fileSize: buffer.length,
      mimeType
    };
    
    const updatedDocs = [...submission.uploadedDocuments, uploadedDoc];
    
    // Update submission
    await cosmosService.updateSubmission(submissionId, submission.leadId, {
      uploadedDocuments: updatedDocs,
      updatedAt: new Date()
    });
    
    context.log(`Uploaded document ${docId} for submission ${submissionId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Document uploaded successfully',
        data: uploadedDoc
      }
    });
  } catch (error: any) {
    context.error('Upload document error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to upload document',
        details: error.message
      }
    });
  }
}

app.http('uploadDocument', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/documents',
  handler: uploadDocument
});
