/**
 * Approve Submission (Staff)
 * POST /api/emaf/submissions/{id}/approve
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { ApproveSubmissionRequest } from '../../models/emafTypes';

export async function approveSubmission(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // TODO: Re-enable auth once staff authentication is properly set up
    // const userContext = await ensureAuthorized(request);
    // await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_APPROVE);
    
    const submissionId = request.params.id;
    const body: ApproveSubmissionRequest = await request.json() as ApproveSubmissionRequest;
    
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
    
    if (submission.status !== 'pending_approval') {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: `Cannot approve submission with status: ${submission.status}`
        }
      });
    }
    
    // Update submission
    const updated = await cosmosService.updateSubmission(submissionId, submission.leadId, {
      status: 'approved',
      reviewedAt: new Date(),
      reviewedBy: body.approvedBy || 'staff',
      reviewNotes: body.reviewNotes,
      updatedAt: new Date()
    });
    
    // Publish event
    await eventGridService.publishSubmissionApproved({
      submissionId: updated.submissionId,
      leadId: updated.leadId,
      quotationId: updated.quotationId,
      vendorId: updated.vendorId,
      vendorName: updated.vendorName,
      approvedBy: updated.reviewedBy!,
      approvedAt: updated.reviewedAt!,
      reviewNotes: updated.reviewNotes
    });
    
    context.log(`Approved EMAF submission ${submissionId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Submission approved successfully',
        data: updated
      }
    });
  } catch (error: any) {
    context.error('Approve submission error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to approve submission',
        details: error.message
      }
    });
  }
}

app.http('approveSubmission', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'emaf/submissions/details/{id}/approve', // Changed to match new pattern
  handler: approveSubmission
});
