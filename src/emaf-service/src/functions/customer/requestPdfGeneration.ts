/**
 * Request PDF Generation (Customer)
 * POST /api/customer/emaf/{submissionId}/generate-pdf
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { queueService } from '../../services/queueService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { v4 as uuidv4 } from 'uuid';

export async function requestPdfGeneration(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.submissionId;
    const body = await request.json() as any;
    const leadId = body.leadId;
    
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
    
    // Create PDF generation job
    const jobId = uuidv4();
    await queueService.enqueuePdfGeneration({
      jobId,
      submissionId,
      leadId: submission.leadId
    });
    
    // Update submission with job ID
    await cosmosService.updateSubmission(submissionId, leadId, {
      pdfGenerationJobId: jobId,
      status: 'pdf_generated', // Will be updated by queue processor
      updatedAt: new Date()
    });
    
    context.log(`Queued PDF generation for submission ${submissionId}`);
    
    return withCors(request, {
      status: 202,
      jsonBody: {
        success: true,
        jobId,
        message: 'PDF generation queued',
        statusUrl: `/api/customer/emaf/${submissionId}/pdf-status`
      }
    });
  } catch (error: any) {
    context.error('Request PDF generation error:', error);
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to queue PDF generation',
        details: error.message
      }
    });
  }
}

app.http('requestPdfGeneration', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/generate-pdf',
  handler: requestPdfGeneration
});
