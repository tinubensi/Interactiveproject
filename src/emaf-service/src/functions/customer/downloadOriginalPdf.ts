/**
 * Download Original Vendor PDF (Customer)
 * GET /api/customer/emaf/{token}/download-pdf
 * Returns the blank vendor PDF for manual filling and signing
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function downloadOriginalPdf(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    
    if (!token) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Token is required'
        }
      });
    }
    
    context.log(`Downloading original vendor PDF for token: ${token}`);
    
    // Token is the submission ID - get submission directly
    const submission = await cosmosService.getSubmissionById(token);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'EMAF submission not found'
        }
      });
    }
    
    // Get template
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'EMAF template not found'
        }
      });
    }
    
    // Check if vendor PDF path is configured
    if (!template.vendorPdfBlobPath) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Original vendor PDF not configured for this template'
        }
      });
    }
    
    context.log(`Downloading vendor PDF from blob: ${template.vendorPdfBlobPath}`);
    
    // Download the original vendor PDF from blob storage
    const pdfBuffer = await blobService.downloadBlob(template.vendorPdfBlobPath);
    
    if (!pdfBuffer || pdfBuffer.length === 0) {
      return withCors(request, {
        status: 500,
        jsonBody: { 
          success: false,
          error: 'Failed to download vendor PDF'
        }
      });
    }
    
    context.log(`Successfully downloaded vendor PDF (${pdfBuffer.length} bytes)`);
    
    // Return the PDF with appropriate headers
    return withCors(request, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${template.vendorCode}-Medical-Application-Form.pdf"`,
        'Content-Length': pdfBuffer.length.toString()
      },
      body: pdfBuffer
    });
  } catch (error: any) {
    context.error('Download original PDF error:', error);
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to download original PDF',
        details: error.message
      }
    });
  }
}

app.http('downloadOriginalPdf', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/download-pdf',
  handler: downloadOriginalPdf
});
