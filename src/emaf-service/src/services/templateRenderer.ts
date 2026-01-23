/**
 * Template Renderer Service
 * Renders HTML templates using Handlebars with form data
 */

import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

class TemplateRenderer {
  private templatesPath: string;
  
  constructor() {
    // Templates are in src/templates/vendors
    this.templatesPath = join(__dirname, '../templates/vendors');
    
    // Register Handlebars helpers
    this.registerHelpers();
  }
  
  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Equality helper
    Handlebars.registerHelper('eq', function(a: any, b: any) {
      return a === b;
    });
    
    // Greater than helper
    Handlebars.registerHelper('gt', function(a: any, b: any) {
      return a > b;
    });
    
    // Less than helper
    Handlebars.registerHelper('lt', function(a: any, b: any) {
      return a < b;
    });
    
    // Format date helper
    Handlebars.registerHelper('formatDate', function(date: any) {
      if (!date) return '';
      try {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB'); // DD/MM/YYYY format
      } catch {
        return date;
      }
    });
    
    // Format date with Arabic
    Handlebars.registerHelper('formatDateArabic', function(date: any) {
      if (!date) return '';
      try {
        const d = new Date(date);
        return d.toLocaleDateString('ar-AE'); // Arabic format
      } catch {
        return date;
      }
    });
    
    // Uppercase helper
    Handlebars.registerHelper('uppercase', function(str: string) {
      return str ? str.toUpperCase() : '';
    });
    
    // Lowercase helper
    Handlebars.registerHelper('lowercase', function(str: string) {
      return str ? str.toLowerCase() : '';
    });
    
    // Default value helper
    Handlebars.registerHelper('default', function(value: any, defaultValue: any) {
      return value !== undefined && value !== null && value !== '' ? value : defaultValue;
    });
    
    // Join array helper
    Handlebars.registerHelper('join', function(array: any[], separator: string) {
      if (!Array.isArray(array)) return '';
      return array.join(separator || ', ');
    });
    
    // Conditional helper for checkboxes
    Handlebars.registerHelper('isChecked', function(value: any, expectedValue: any) {
      return value === expectedValue || value === true;
    });
    
    // Number formatting
    Handlebars.registerHelper('formatNumber', function(num: any) {
      if (num === undefined || num === null) return '';
      return Number(num).toLocaleString();
    });
    
    // Index helper (for loop counter)
    Handlebars.registerHelper('increment', function(value: number) {
      return value + 1;
    });
    
    // Debug helper (for development)
    Handlebars.registerHelper('debug', function(value: any) {
      console.log('Debug:', JSON.stringify(value, null, 2));
      return '';
    });
  }
  
  /**
   * Render HTML template with form data
   * @param vendorCode - Vendor code (e.g., 'alsagr', 'watania')
   * @param formData - Form data to populate template
   * @returns Rendered HTML string
   */
  async renderTemplate(
    vendorCode: string,
    formData: Record<string, any>
  ): Promise<string> {
    const templateFileName = `${vendorCode}-emaf.hbs`;
    const templatePath = join(this.templatesPath, templateFileName);
    
    try {
      console.log(`Loading template from: ${templatePath}`);
      
      // Read template file
      const templateSource = readFileSync(templatePath, 'utf-8');
      
      // Compile template
      const template = Handlebars.compile(templateSource);
      
      // Prepare template data with additional computed fields
      const templateData = {
        ...formData,
        // Add metadata
        generatedDate: new Date().toLocaleDateString('en-GB'),
        generatedDateTime: new Date().toLocaleString('en-GB'),
        currentYear: new Date().getFullYear(),
        // Helper flags
        hasInsuredMembers: formData.insuredMembers && formData.insuredMembers.length > 0,
        hasMedicalQuestions: formData.medicalQuestions && formData.medicalQuestions.length > 0,
        hasPreviousInsurance: formData.previousInsurance && formData.previousInsurance.length > 0,
      };
      
      // Render template
      const html = template(templateData);
      
      console.log(`Template rendered successfully for vendor: ${vendorCode}`);
      
      return html;
    } catch (error: any) {
      console.error(`Failed to render template for ${vendorCode}:`, error);
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }
  
  /**
   * Check if template exists for vendor
   * @param vendorCode - Vendor code
   * @returns True if template exists
   */
  templateExists(vendorCode: string): boolean {
    const templateFileName = `${vendorCode}-emaf.hbs`;
    const templatePath = join(this.templatesPath, templateFileName);
    
    try {
      readFileSync(templatePath, 'utf-8');
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get list of available templates
   * @returns Array of vendor codes with templates
   */
  getAvailableTemplates(): string[] {
    try {
      const fs = require('fs');
      const files = fs.readdirSync(this.templatesPath);
      
      return files
        .filter((file: string) => file.endsWith('-emaf.hbs'))
        .map((file: string) => file.replace('-emaf.hbs', ''));
    } catch (error) {
      console.error('Failed to list templates:', error);
      return [];
    }
  }
}

// Export singleton instance
export const templateRenderer = new TemplateRenderer();
