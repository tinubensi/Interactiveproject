/**
 * PDF Generator Service for EMAF
 * Generates PDFs from HTML templates using Playwright
 */

import { chromium, Browser } from 'playwright';
import { readFileSync } from 'fs';
import { join } from 'path';
import { EmafSubmission, EmafTemplate } from '../models/emafTypes';
import { templateRenderer } from './templateRenderer';
import { cosmosService } from './cosmosService';

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
      
      // Fetch lead data for salary information (use HTTP API - leads are in different database)
      let leadData: any = null;
      
      try {
        const leadServiceUrl = process.env.LEAD_SERVICE_URL || process.env.LEAD_SERVICE_BASE_URL || 'https://lead-service.azurewebsites.net';
        console.log(`   Fetching lead data for salary: ${submission.leadId}`);
        console.log(`   Service URL: ${leadServiceUrl}/api/leads/get/${submission.leadId}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(
          `${leadServiceUrl}/api/leads/get/${submission.leadId}?lineOfBusiness=medical`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'x-service-key': process.env.INTERNAL_SERVICE_KEY || process.env.AUTH_SERVICE_KEY || '',
            },
            signal: controller.signal,
          }
        );
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const result: any = await response.json();
          leadData = result.data?.lead || result.lead || result;
          console.log(`   ✓ Lead data fetched successfully`);
          console.log(`   Lead has lobData:`, !!leadData?.lobData);
          console.log(`   Salary field:`, leadData?.lobData?.salary || leadData?.lobData?.salaryRange || 'NOT FOUND');
        } else {
          const errorText = await response.text().catch(() => '');
          console.log(`   ⚠️ HTTP fetch failed (status: ${response.status})`);
          if (errorText) {
            console.log(`   Error details: ${errorText.substring(0, 200)}`);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log(`   ⚠️ Lead fetch timeout after 5 seconds`);
        } else {
          console.log(`   ⚠️ Lead fetch error: ${error.message || String(error)}`);
        }
      }
      
      if (!leadData) {
        console.log(`   ⚠️ No lead data available - salary will not be prefilled from lead`);
      }
      
      console.log('   Step 1b: Rendering template with form data...');
      const html = await templateRenderer.renderTemplate(
        template.vendorCode,
        submission.formData,
        leadData
      );
      console.log(`   ✓ Template rendered with data (${html.length} characters)`);
      
      console.log('   Step 2: Launching browser...');
      const browser = await this.getBrowser();
      
      // Create context with JavaScript disabled for security
      const context = await browser.newContext({
        javaScriptEnabled: false,
      });
      const page = await context.newPage();
      console.log('   ✓ Browser page created (JavaScript disabled for security)');
      
      console.log('   Step 3: Loading HTML content...');
      await page.setContent(html, {
        waitUntil: 'domcontentloaded', // Changed from networkidle since JS is disabled
        timeout: 30000
      });
      console.log('   ✓ HTML content loaded');
      
      console.log('   Step 4: Generating PDF...');
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        // Disable PDF features that could be flagged as dangerous
        displayHeaderFooter: false,
        // Print tagged PDF for accessibility and security
        tagged: true,
        // Removed margin option to respect CSS @page { margin: 0; }
      });
      console.log(`   ✓ PDF generated (${pdfBuffer.length} bytes)`);
      
      await page.close();
      await context.close();
      
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
