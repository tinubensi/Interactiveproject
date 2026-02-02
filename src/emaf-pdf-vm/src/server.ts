/**
 * EMAF PDF Generation Service
 * Express server for PDF generation on VM
 */

import 'dotenv/config';
import express from 'express';
import { cosmosService } from './services/cosmosService';
import { blobService } from './services/blobService';
import { pdfGeneratorService } from './services/pdfGeneratorService';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    browserReady: pdfGeneratorService.isBrowserReady(),
    service: 'emaf-pdf-service'
  });
});

/**
 * PDF proxy endpoint - serves PDFs through our domain instead of blob storage
 * GET /api/pdf/:leadId/:submissionId/prefilled.pdf
 */
app.get('/api/pdf/:leadId/:submissionId/prefilled.pdf', async (req, res) => {
  try {
    const { leadId, submissionId } = req.params;
    
    // Construct blob path
    const blobPath = `emaf-pdfs/${leadId}/${submissionId}/prefilled.pdf`;
    
    console.log(`📥 PDF download request: ${blobPath}`);
    
    // Download PDF from blob storage
    const pdfBuffer = await blobService.downloadPdf(blobPath);
    
    // Set security headers and serve PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="prefilled.pdf"');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline';");
    
    res.send(pdfBuffer);
    
    console.log(`✅ PDF served successfully: ${pdfBuffer.length} bytes`);
  } catch (error: any) {
    console.error('❌ PDF download failed:', error);
    res.status(404).json({
      success: false,
      error: 'PDF not found',
      details: error.message
    });
  }
});

/**
 * PDF generation endpoint
 * POST /api/generate-pdf
 * Body: { submissionId: string, leadId: string }
 */
app.post('/api/generate-pdf', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { submissionId, leadId } = req.body;
    
    if (!submissionId || !leadId) {
      return res.status(400).json({
        success: false,
        error: 'submissionId and leadId are required'
      });
    }
    
    console.log(`\n📋 PDF generation request received`);
    console.log(`   Submission ID: ${submissionId}`);
    console.log(`   Lead ID: ${leadId}`);
    
    // Get submission
    const submission = await cosmosService.getSubmission(submissionId, leadId);
    
    if (!submission) {
      return res.status(404).json({
        success: false,
        error: `Submission not found: ${submissionId}`
      });
    }
    
    // Get template
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    if (!template) {
      return res.status(404).json({
        success: false,
        error: `Template not found: ${submission.emafTemplateId}`
      });
    }
    
    console.log(`📄 Template: ${template.name}`);
    console.log(`📊 Vendor: ${template.vendorCode}`);
    
    // Generate PDF
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(submission, template);
    
    console.log(`✅ PDF generated, size: ${pdfBuffer.length} bytes`);
    
    // Upload to blob storage
    const blobPath = `emaf-pdfs/${leadId}/${submissionId}/prefilled.pdf`;
    await blobService.uploadPdf(blobPath, pdfBuffer);
    
    console.log(`☁️  PDF uploaded to blob: ${blobPath}`);
    
    // Generate SAS URL (valid 7 days)
    const sasUrl = await blobService.generateDownloadSasUri(blobPath, 7 * 24 * 60);
    
    // Update submission in Cosmos
    await cosmosService.updateSubmission(submissionId, leadId, {
      generatedPdfBlobPath: blobPath,
      generatedPdfSasUrl: sasUrl,
      pdfGeneratedAt: new Date(),
      status: 'pdf_generated',
      updatedAt: new Date()
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ PDF generation completed successfully in ${duration}s\n`);
    
    res.json({
      success: true,
      pdfUrl: sasUrl, // Return SAS URL - works everywhere
      blobPath,
      duration: `${duration}s`
    });
    
  } catch (error: any) {
    console.error('\n❌ PDF generation failed:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack:', error.stack);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate PDF',
      details: error.message,
      duration: `${duration}s`
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 EMAF PDF Service started`);
  console.log(`   Port: ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   Health check: http://localhost:${PORT}/health\n`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await pdfGeneratorService.closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await pdfGeneratorService.closeBrowser();
  process.exit(0);
});
