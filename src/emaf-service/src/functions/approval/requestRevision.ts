/**
 * Request Revision (Staff)
 * POST /api/emaf/submissions/{id}/request-revision
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { eventGridService } from '../../services/eventGridService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { RequestRevisionRequest } from '../../models/emafTypes';

export async function requestRevision(
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
    const body: RequestRevisionRequest = await request.json() as RequestRevisionRequest;
    
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
          error: 'reviewNotes are required for revision request'
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
          error: `Cannot request revision for submission with status: ${submission.status}`
        }
      });
    }
    
    // Update submission
    const updated = await cosmosService.updateSubmission(submissionId, submission.leadId, {
      status: 'revision_required',
      reviewedAt: new Date(),
      reviewedBy: body.requestedBy || 'staff',
      reviewNotes: body.reviewNotes,
      updatedAt: new Date()
    });
    
    // Publish event
    await eventGridService.publishRevisionRequested({
      submissionId: updated.submissionId,
      leadId: updated.leadId,
      quotationId: updated.quotationId,
      vendorId: updated.vendorId,
      vendorName: updated.vendorName,
      requestedBy: updated.reviewedBy!,
      requestedAt: updated.reviewedAt!,
      reviewNotes: updated.reviewNotes!
    });
    
    context.log(`Requested revision for EMAF submission ${submissionId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Revision requested successfully',
        data: updated
      }
    });
  } catch (error: any) {
    context.error('Request revision error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to request revision',
        details: error.message
      }
    });
  }
}

app.http('requestRevision', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'emaf/submissions/details/{id}/request-revision', // Changed to match new pattern
  handler: requestRevision
});
