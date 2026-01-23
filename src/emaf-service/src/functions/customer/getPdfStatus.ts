/**
 * Get PDF Status (Customer)
 * GET /api/customer/emaf/{submissionId}/pdf-status
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function getPdfStatus(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.submissionId;
    const leadId = request.query.get('leadId');
    
    if (!submissionId || !leadId) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'submissionId and leadId are required'
        }
      });
    }
    
    const submission = await cosmosService.getSubmission(submissionId, leadId);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Submission not found'
        }
      });
    }
    
    const status = {
      jobId: submission.pdfGenerationJobId,
      status: submission.generatedPdfSasUrl ? 'completed' : 'processing',
      pdfUrl: submission.generatedPdfSasUrl || null,
      generatedAt: submission.pdfGeneratedAt || null
    };
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: status
      }
    });
  } catch (error: any) {
    context.error('Get PDF status error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to get PDF status',
        details: error.message
      }
    });
  }
}

app.http('getPdfStatus', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/pdf-status',
  handler: getPdfStatus
});
