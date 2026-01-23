/**
 * Process PDF Generation Queue
 * Queue Trigger: pdf-generation-queue
 */

import { app, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { blobService } from '../../services/blobService';
import { pdfGeneratorService } from '../../services/pdfGeneratorService';
import { eventGridService } from '../../services/eventGridService';

export async function processPdfGeneration(
  queueMessage: string,
  context: InvocationContext
): Promise<void> {
  let jobData: any;
  
  try {
    // Parse queue message
    jobData = JSON.parse(queueMessage);
    const { jobId, submissionId, leadId } = jobData;
    
    context.log(`Processing PDF generation job ${jobId} for submission ${submissionId}`);
    
    // Get submission
    const submission = await cosmosService.getSubmission(submissionId, leadId);
    
    if (!submission) {
      throw new Error(`Submission not found: ${submissionId}`);
    }
    
    // Get template
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    if (!template) {
      throw new Error(`Template not found: ${submission.emafTemplateId}`);
    }
    
    context.log(`Generating PDF for ${template.name}`);
    
    // Generate PDF
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(submission, template);
    
    context.log(`PDF generated, size: ${pdfBuffer.length} bytes`);
    
    // Upload to blob storage
    const blobPath = `emaf-pdfs/${leadId}/${submissionId}/prefilled.pdf`;
    await blobService.uploadPdf(blobPath, pdfBuffer);
    
    context.log(`PDF uploaded to blob: ${blobPath}`);
    
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
    
    context.log(`Submission updated with PDF URL`);
    
    // Publish event
    await eventGridService.publishPdfGenerated({
      submissionId: submission.submissionId,
      leadId: submission.leadId,
      quotationId: submission.quotationId,
      vendorId: submission.vendorId,
      vendorName: submission.vendorName,
      pdfUrl: sasUrl,
      pdfBlobPath: blobPath
    });
    
    context.log(`PDF generated successfully for submission ${submissionId}`);
  } catch (error: any) {
    context.error('PDF generation failed:', error);
    
    // Log error details for debugging
    if (jobData) {
      context.error(`Job details: ${JSON.stringify(jobData)}`);
    }
    
    // Queue will retry automatically up to maxDequeueCount times
    throw error;
  }
}

app.storageQueue('processPdfGeneration', {
  queueName: 'pdf-generation-queue',
  connection: 'AzureWebJobsStorage',
  handler: processPdfGeneration
});
