/**
 * Upload Generated PDF (Customer)
 * POST /api/customer/emaf/{token}/upload-generated-pdf
 * 
 * Accepts a PDF file generated client-side and uploads it to blob storage
 * This is optional - PDFs can also be downloaded directly without uploading
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function uploadGeneratedPdf(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const submissionId = request.params.token; // token is the submissionId
    const body = await request.json() as any;
    const leadId = body.leadId;
    const pdfBase64 = body.pdfBase64; // Base64 encoded PDF
    
    if (!submissionId || !leadId || !pdfBase64) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'submissionId, leadId, and pdfBase64 are required'
        }
      });
    }
    
    // Get submission
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
    
    // Decode base64 PDF
    let pdfBuffer: Buffer;
    try {
      // Remove data URL prefix if present (e.g., "data:application/pdf;base64,")
      const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
      pdfBuffer = Buffer.from(base64Data, 'base64');
    } catch (error: any) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Invalid base64 PDF data'
        }
      });
    }
    
    // Validate PDF buffer (basic check - should start with PDF header)
    if (pdfBuffer.length < 4 || pdfBuffer.toString('ascii', 0, 4) !== '%PDF') {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Invalid PDF file format'
        }
      });
    }
    
    context.log(`📤 Uploading generated PDF for submission ${submissionId} (${pdfBuffer.length} bytes)`);
    
    // Upload to blob storage
    const blobPath = `emaf-pdfs/${leadId}/${submissionId}/prefilled.pdf`;
    await blobService.uploadPdf(blobPath, pdfBuffer);
    
    context.log(`☁️  PDF uploaded to blob: ${blobPath}`);
    
    // Generate SAS URL (valid 7 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 7 * 24 * 60);
    
    // Update submission
    await cosmosService.updateSubmission(submissionId, leadId, {
      generatedPdfBlobPath: blobPath,
      generatedPdfSasUrl: sasUrl,
      pdfGeneratedAt: new Date(),
      status: 'pdf_generated',
      updatedAt: new Date()
    });
    
    context.log(`✅ PDF uploaded and submission updated successfully!`);
    
    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        pdfUrl: sasUrl,
        message: 'PDF uploaded successfully',
        blobPath
      }
    });
  } catch (error: any) {
    context.error('❌ PDF upload failed:', error);
    context.error('Error stack:', error.stack);
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to upload PDF',
        details: error.message
      }
    });
  }
}

app.http('uploadGeneratedPdf', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}/upload-generated-pdf',
  handler: uploadGeneratedPdf
});
