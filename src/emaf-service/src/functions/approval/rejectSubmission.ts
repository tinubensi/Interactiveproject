/**
 * Reject Submission (Staff)
 * POST /api/emaf/submissions/{id}/reject
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { RejectSubmissionRequest } from '../../models/emafTypes';

export async function rejectSubmission(
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
    const body: RejectSubmissionRequest = await request.json() as RejectSubmissionRequest;
    
    if (!submissionId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'submissionId is required'
        }
      });
    }
    
    if (!body.reviewNotes) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'reviewNotes are required for rejection'
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
          error: `Cannot reject submission with status: ${submission.status}`
        }
      });
    }
    
    // Update submission
    const updated = await cosmosService.updateSubmission(submissionId, submission.leadId, {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: body.rejectedBy || 'staff',
      reviewNotes: body.reviewNotes,
      updatedAt: new Date()
    });
    
    // Publish event
    await eventGridService.publishSubmissionRejected({
      submissionId: updated.submissionId,
      leadId: updated.leadId,
      quotationId: updated.quotationId,
      vendorId: updated.vendorId,
      vendorName: updated.vendorName,
      rejectedBy: updated.reviewedBy!,
      rejectedAt: updated.reviewedAt!,
      reviewNotes: updated.reviewNotes!
    });
    
    context.log(`Rejected EMAF submission ${submissionId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Submission rejected',
        data: updated
      }
    });
  } catch (error: any) {
    context.error('Reject submission error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to reject submission',
        details: error.message
      }
    });
  }
}

app.http('rejectSubmission', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'emaf/submissions/details/{id}/reject', // Changed to match new pattern
  handler: rejectSubmission
});
