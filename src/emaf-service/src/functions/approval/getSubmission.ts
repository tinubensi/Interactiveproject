/**
 * Get Submission (Staff)
 * GET /api/emaf/submissions/{id}
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { ensureAuthorized, requirePermission, EMAF_PERMISSIONS } from '../../lib/auth';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function getSubmission(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    // TODO: Re-enable auth once staff authentication is properly set up
    // const userContext = await ensureAuthorized(request);
    // await requirePermission(userContext.userId, EMAF_PERMISSIONS.EMAF_VIEW);
    
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
    
    // Get template for context
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: {
          submission,
          template
        }
      }
    });
  } catch (error: any) {
    context.error('Get submission error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to get submission',
        details: error.message
      }
    });
  }
}

app.http('getSubmission', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'emaf/submissions/details/{id}', // Changed from 'emaf/submissions/{id}' to avoid conflict with /pending
  handler: getSubmission
});
