/**
 * Request PDF Generation (Customer)
 * POST /api/customer/emaf/{submissionId}/generate-pdf
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { getConfig } from '../../config';
import axios from 'axios';

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
    
    // Call VM PDF service with retry logic
    const config = getConfig();
    const vmUrl = `${config.vmPdfServiceUrl}/generate-pdf`;
    
    context.log(`Calling VM PDF service: ${vmUrl} for submission ${submissionId}`);
    
    let lastError: any = null;
    const maxRetries = 3;
    const retryDelay = 2000; // 2 seconds
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        context.log(`Attempt ${attempt}/${maxRetries} to generate PDF`);
        
        const response = await axios.post(
          vmUrl,
          { submissionId, leadId },
          {
            timeout: 60000, // 60 second timeout
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (response.data.success) {
          context.log(`PDF generated successfully on attempt ${attempt}`);
          
          return withCors(request, {
            status: 200,
            jsonBody: {
              success: true,
              pdfUrl: response.data.pdfUrl,
              blobPath: response.data.blobPath,
              message: 'PDF generated successfully'
            }
          });
        } else {
          throw new Error(response.data.error || 'PDF generation failed');
        }
      } catch (error: any) {
        lastError = error;
        context.warn(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt < maxRetries) {
          context.log(`Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All retries failed
    context.error(`All ${maxRetries} attempts failed. Last error:`, lastError);
    
    return withCors(request, {
      status: 500,
      jsonBody: {
        success: false,
        error: 'Failed to generate PDF after multiple attempts',
        details: lastError?.message || 'Unknown error',
        message: 'PDF generation service unavailable. Please try again later.'
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
