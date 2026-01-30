/**
 * PDF Generator Service for EMAF
 * Generates PDFs from HTML templates using Playwright
 */

import { chromium, Browser } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';
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
      
      try {
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
      } catch (error: any) {
        if (error.message && error.message.includes('Executable doesn\'t exist')) {
          console.warn('Playwright browsers not found. Attempting to install...');
          try {
            const { execSync } = require('child_process');
            execSync('npx playwright install chromium --with-deps', { 
              stdio: 'inherit',
              timeout: 300000
            });
            console.log('Playwright browsers installed. Retrying browser launch...');
            
            this.browser = await chromium.launch({
              args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu'
              ],
              headless: true
            });
            console.log('Browser launched successfully after installation');
          } catch (installError: any) {
            console.error('Failed to install Playwright browsers:', installError);
            throw new Error(
              'Playwright browsers are not installed. ' +
              'Please run: npx playwright install chromium --with-deps. ' +
              'Original error: ' + error.message
            );
          }
        } else {
          throw error;
        }
      }
    }
    return this.browser;
  }
  
  /**
   * Check if browser is ready
   */
  isBrowserReady(): boolean {
    return this.browser !== null && this.browser.isConnected();
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
      if (!templateRenderer.templateExists(template.vendorCode)) {
        throw new Error(
          `HTML template not found for vendor: ${template.vendorCode}. ` +
          `Available templates: ${templateRenderer.getAvailableTemplates().join(', ')}`
        );
      }
      
      console.log('   Step 1: Loading static HTML template (NO DATA PREFILL)...');
      // Temporarily read template as static HTML for pixel-perfect testing
      const normalizedVendorCode = template.vendorCode.toLowerCase();
      const templatePath = join(__dirname, '../../templates/vendors', `${normalizedVendorCode}-emaf.hbs`);
      const html = readFileSync(templatePath, 'utf-8');
      console.log(`   ✓ Static HTML loaded (${html.length} characters)`);

      // ORIGINAL CODE (commented out for now):
      // const html = await templateRenderer.renderTemplate(
      //   template.vendorCode,
      //   submission.formData
      // );
      
      console.log('   Step 2: Launching browser...');
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      console.log('   ✓ Browser page created');
      
      console.log('   Step 3: Loading HTML content...');
      await page.setContent(html, {
        waitUntil: 'networkidle',
        timeout: 30000
      });
      console.log('   ✓ HTML content loaded');
      
      console.log('   Step 4: Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true
        // Removed margin option to respect CSS @page { margin: 0; }
      });
      console.log(`   ✓ PDF generated (${pdfBuffer.length} bytes)`);
      
      await page.close();
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n✅ PDF generation completed in ${duration}s`);
      console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB\n`);
      
      return Buffer.from(pdfBuffer);
    } catch (error: any) {
      console.error('\n❌ PDF generation failed:', error);
      console.error('   Error details:', error.message);
      
      try {
        await this.closeBrowser();
      } catch (closeError) {
        console.error('   Failed to close browser:', closeError);
      }
      
      throw new Error(`Failed to generate PDF: ${error.message}`);
    }
  }
}

export const pdfGeneratorService = new PdfGeneratorService();

// Cleanup on process exit
process.on('beforeExit', async () => {
  await pdfGeneratorService.closeBrowser();
});

process.on('SIGTERM', async () => {
  await pdfGeneratorService.closeBrowser();
  process.exit(0);
});
