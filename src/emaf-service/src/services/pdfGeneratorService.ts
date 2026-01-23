/**
 * PDF Generator Service for EMAF
 * Generates PDFs from HTML templates using Playwright
 */

import { chromium, Browser, Page } from 'playwright';
import { EmafSubmission, EmafTemplate } from '../models/emafTypes';
import { templateRenderer } from './templateRenderer';

class PdfGeneratorService {
  private browser: Browser | null = null;
  
  /**
   * Initialize browser (reuse for performance)
   */
  private async getBrowser(): Promise<Browser> {
    if (!this.browser || !this.browser.isConnected()) {
      console.log('Launching Chromium browser...');
      this.browser = await chromium.launch({
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ],
        headless: true
      });
      console.log('Browser launched successfully');
    }
    return this.browser;
  }
  
  /**
   * Close browser connection
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }
  
  /**
   * Generate PDF from HTML template
   * @param submission - EMAF submission with form data
   * @param template - EMAF template configuration
   * @returns PDF buffer
   */
  async generatePrefilledPdf(
    submission: EmafSubmission,
    template: EmafTemplate
  ): Promise<Buffer> {
    console.log(`\n📄 Starting PDF generation for vendor: ${template.vendorCode}`);
    console.log(`   Submission ID: ${submission.submissionId}`);
    console.log(`   Template: ${template.name}`);
    
    const startTime = Date.now();
    
    try {
      // Check if HTML template exists
      if (!templateRenderer.templateExists(template.vendorCode)) {
        throw new Error(
          `HTML template not found for vendor: ${template.vendorCode}. ` +
          `Available templates: ${templateRenderer.getAvailableTemplates().join(', ')}`
        );
      }
      
      // Step 1: Render HTML template with form data
      console.log('   Step 1: Rendering HTML template...');
      const html = await templateRenderer.renderTemplate(
        template.vendorCode,
        submission.formData
      );
      console.log(`   ✓ HTML rendered (${html.length} characters)`);
      
      // Step 2: Launch browser and create page
      console.log('   Step 2: Launching browser...');
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      console.log('   ✓ Browser page created');
      
      // Step 3: Load HTML content
      console.log('   Step 3: Loading HTML content...');
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('   ✓ HTML content loaded');
      
      // Step 4: Generate PDF
      console.log('   Step 4: Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        margin: {
          top: '10mm',
          right: '10mm',
          bottom: '10mm',
          left: '10mm'
        }
      });
      console.log(`   ✓ PDF generated (${pdfBuffer.length} bytes)`);
      
      // Close page (but keep browser for reuse)
      await page.close();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ PDF generation completed in ${duration}s`);
      console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);
      
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('\n❌ PDF generation failed:', error);
      console.error('   Error details:', error.message);
      
      // Try to close browser on error
      try {
        await this.closeBrowser();
      } catch (closeError) {
        console.error('   Failed to close browser:', closeError);
      }
      
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }
  
  /**
   * Preview HTML (for development/testing)
   * @param vendorCode - Vendor code
   * @param formData - Form data
   * @returns Rendered HTML string
   */
  async previewHtml(
    vendorCode: string,
    formData: Record<string, any>
  ): Promise<string> {
    console.log(`Generating HTML preview for vendor: ${vendorCode}`);
    return templateRenderer.renderTemplate(vendorCode, formData);
  }
  
  /**
   * Generate PDF from HTML string (for testing)
   * @param html - HTML content
   * @returns PDF buffer
   */
  async generatePdfFromHtml(html: string): Promise<Buffer> {
    console.log('Generating PDF from HTML string...');
    
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true
      });
      
      await page.close();
      
      console.log(`PDF generated: ${pdfBuffer.length} bytes`);
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('PDF generation from HTML failed:', error);
      throw new Error(`Failed to generate PDF from HTML: ${error.message}`);
    }
  }
  
  /**
   * Take screenshot of HTML (for debugging)
   * @param html - HTML content
   * @returns Screenshot buffer (PNG)
   */
  async screenshotHtml(html: string): Promise<Buffer> {
    console.log('Taking screenshot of HTML...');
    
    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      
      const screenshot = await page.screenshot({
        fullPage: true,
        type: 'png'
      });
      
      await page.close();
      
      console.log(`Screenshot captured: ${screenshot.length} bytes`);
      return Buffer.from(screenshot);
    } catch (error: any) {
      console.error('Screenshot failed:', error);
      throw new Error(`Failed to capture screenshot: ${error.message}`);
    }
  }
  
  /**
   * Validate template rendering (for testing)
   * @param vendorCode - Vendor code
   * @param formData - Sample form data
   * @returns Validation result
   */
  async validateTemplate(
    vendorCode: string,
    formData: Record<string, any>
  ): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    try {
      // Check if template exists
      if (!templateRenderer.templateExists(vendorCode)) {
        errors.push(`Template not found for vendor: ${vendorCode}`);
        return { valid: false, errors, warnings };
      }
      
      // Try to render HTML
      const html = await templateRenderer.renderTemplate(vendorCode, formData);
      
      if (!html || html.length === 0) {
        errors.push('Rendered HTML is empty');
      }
      
      // Check for common issues
      if (!html.includes('<!DOCTYPE html>')) {
        warnings.push('Missing DOCTYPE declaration');
      }
      
      if (!html.includes('<html')) {
        errors.push('Missing HTML tag');
      }
      
      if (!html.includes('<head>')) {
        warnings.push('Missing HEAD tag');
      }
      
      if (!html.includes('<body>')) {
        errors.push('Missing BODY tag');
      }
      
      // Try to generate PDF
      try {
        const pdfBuffer = await this.generatePdfFromHtml(html);
        if (pdfBuffer.length < 1000) {
          warnings.push('Generated PDF seems too small (< 1KB)');
        }
      } catch (pdfError: any) {
        errors.push(`PDF generation failed: ${pdfError.message}`);
      }
      
      return {
        valid: errors.length === 0,
        errors,
        warnings
      };
    } catch (error: any) {
      errors.push(`Validation failed: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }
}

// Export singleton instance
export const pdfGeneratorService = new PdfGeneratorService();

// Cleanup on process exit
process.on('beforeExit', async () => {
  await pdfGeneratorService.closeBrowser();
});

process.on('SIGTERM', async () => {
  await pdfGeneratorService.closeBrowser();
  process.exit(0);
});
