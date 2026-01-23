/**
 * Generate PDF Directly (Customer) - For Local Testing
 * POST /api/customer/emaf/{submissionId}/generate-pdf-direct
 * 
 * This bypasses the queue and generates PDF synchronously
 * Use this for local development/testing
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { pdfGeneratorService } from '../../services/pdfGeneratorService';
import { handlePreflight, withCors } from '../../lib/corsHelper';

export async function generatePdfDirect(
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
    
    context.log(`🔄 Generating PDF directly for submission ${submissionId}`);
    
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
          error: 'Template not found'
        }
      });
    }
    
    context.log(`📄 Template: ${template.name}`);
    context.log(`📊 Mappings: ${template.pdfFieldMappings?.length || 0} fields`);
    context.log(`📝 Form data keys: ${Object.keys(submission.formData || {}).length}`);
    
    // Generate PDF
    context.log('🎨 Generating PDF with overlays...');
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(submission, template);
    
    context.log(`✅ PDF generated, size: ${pdfBuffer.length} bytes`);
    
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
    
    context.log(`✅ PDF generated successfully!`);
    
    return withCors(request, {
      status: 200,
      jsonBody: {
        success: true,
        pdfUrl: sasUrl,
        message: 'PDF generated successfully',
        blobPath
      }
    });
  } catch (error: any) {
    context.error('❌ PDF generation failed:', error);
    context.error('Error stack:', error.stack);
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to generate PDF',
        details: error.message
      }
    });
  }
}

app.http('generatePdfDirect', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{submissionId}/generate-pdf-direct',
  handler: generatePdfDirect
});
