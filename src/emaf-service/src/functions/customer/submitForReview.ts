/**
 * Submit for Review (Customer)
 * POST /api/customer/emaf/{submissionId}/submit
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function submitForReview(
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
    
    // Get submission by ID (token is submissionId)
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
    
    // Validate submission is complete
    if (!submission.signedPdfBlobPath) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Signed PDF is required before submission'
        }
      });
    }
    
    // Get template to check required documents
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    // Check if all required documents are uploaded
    const requiredDocs = template?.requiredDocuments.filter(d => d.required) || [];
    const uploadedTypes = submission.uploadedDocuments.map(d => d.documentRequirementId);
    const missingDocs = requiredDocs.filter(d => !uploadedTypes.includes(d.id));
    
    if (missingDocs.length > 0) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Required documents are missing',
          missingDocuments: missingDocs.map(d => d.label)
        }
      });
    }
    
    // Update submission status
    const updated = await cosmosService.updateSubmission(submissionId, submission.leadId, {
      status: 'pending_approval',
      submittedAt: new Date(),
      updatedAt: new Date()
    });
    
    // Publish event
    await eventGridService.publishSubmissionSubmitted({
      submissionId: updated.submissionId,
      leadId: updated.leadId,
      quotationId: updated.quotationId,
      vendorId: updated.vendorId,
      vendorName: updated.vendorName,
      submittedAt: updated.submittedAt!,
      hasSignedPdf: !!updated.signedPdfBlobPath,
      uploadedDocumentsCount: updated.uploadedDocuments.length
    });
    
    context.log(`Submitted EMAF ${submissionId} for approval`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'EMAF submitted for review successfully',
        data: {
          submissionId: updated.submissionId,
          status: updated.status,
          submittedAt: updated.submittedAt
        }
      }
    });
  } catch (error: any) {
    context.error('Submit for review error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to submit for review',
        details: error.message
      }
    });
  }
}

app.http('submitForReview', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/submit',
  handler: submitForReview
});
