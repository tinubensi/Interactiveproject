/**
 * Save EMAF Data (Customer Auto-save)
 * POST /api/customer/emaf/{submissionId}/save
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { SaveEmafDataRequest } from '../../models/emafTypes';

export async function saveEmafData(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.submissionId;
    const body: SaveEmafDataRequest = await request.json() as SaveEmafDataRequest;
    
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
    
    // Update form data
    // Only change status to 'form_completed' if this is a final submission
    // Auto-save (when clicking Next) should keep status as 'draft'
    const newStatus = body.isFinalSubmission && submission.status === 'draft' 
      ? 'form_completed' 
      : submission.status;
    
    const updated = await cosmosService.updateSubmission(submissionId, submission.leadId, {
      formData: body.formData,
      status: newStatus,
      updatedAt: new Date()
    });
    
    context.log(`Saved EMAF data for submission ${submissionId}`);
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        message: 'Progress saved successfully',
        data: updated
      }
    });
  } catch (error: any) {
    context.error('Save EMAF data error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to save data',
        details: error.message
      }
    });
  }
}

app.http('saveEmafData', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/save',
  handler: saveEmafData
});
