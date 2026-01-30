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
    // Templates are in templates/vendors (relative to dist folder)
    this.templatesPath = join(__dirname, '../../templates/vendors');
    
    // Register Handlebars helpers
    this.registerHelpers();
  }
  
  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    Handlebars.registerHelper('eq', function(a: any, b: any) {
      return a === b;
    });
    
    Handlebars.registerHelper('gt', function(a: any, b: any) {
      return a > b;
    });
    
    Handlebars.registerHelper('lt', function(a: any, b: any) {
      return a < b;
    });
    
    Handlebars.registerHelper('formatDate', function(date: any) {
      if (!date) return '';
      try {
        const d = new Date(date);
        return d.toLocaleDateString('en-GB');
      } catch {
        return date;
      }
    });
    
    Handlebars.registerHelper('formatDateArabic', function(date: any) {
      if (!date) return '';
      try {
        const d = new Date(date);
        return d.toLocaleDateString('ar-AE');
      } catch {
        return date;
      }
    });
    
    Handlebars.registerHelper('uppercase', function(str: string) {
      return str ? str.toUpperCase() : '';
    });
    
    Handlebars.registerHelper('lowercase', function(str: string) {
      return str ? str.toLowerCase() : '';
    });
    
    Handlebars.registerHelper('default', function(value: any, defaultValue: any) {
      return value !== undefined && value !== null && value !== '' ? value : defaultValue;
    });
    
    Handlebars.registerHelper('join', function(array: any[], separator: string) {
      if (!Array.isArray(array)) return '';
      return array.join(separator || ', ');
    });
    
    Handlebars.registerHelper('isChecked', function(value: any, expectedValue: any) {
      return value === expectedValue || value === true;
    });
    
    Handlebars.registerHelper('formatNumber', function(num: any) {
      if (num === undefined || num === null) return '';
      return Number(num).toLocaleString();
    });
    
    Handlebars.registerHelper('increment', function(value: number) {
      return value + 1;
    });
    
    Handlebars.registerHelper('debug', function(value: any) {
      console.log('Debug:', JSON.stringify(value, null, 2));
      return '';
    });
    
    Handlebars.registerHelper('splitDate', function(date: any, format: string = 'DD/MM/YYYY') {
      if (!date) {
        if (format === 'DD/MM/YYYY') {
          return '<span class="date-box placeholder">d</span><span class="date-box placeholder">d</span><span class="date-box placeholder">m</span><span class="date-box placeholder">m</span><span class="date-box placeholder">y</span><span class="date-box placeholder">y</span><span class="date-box placeholder">y</span><span class="date-box placeholder">y</span>';
        } else if (format === 'DD/MM/YY') {
          return '<span class="date-box placeholder">d</span><span class="date-box placeholder">d</span><span class="date-box placeholder">m</span><span class="date-box placeholder">m</span><span class="date-box placeholder">y</span><span class="date-box placeholder">y</span>';
        }
        return '';
      }
      
      try {
        let dateStr: string;
        if (typeof date === 'string') {
          if (date.includes('/')) {
            dateStr = date;
          } else {
            const d = new Date(date);
            const day = String(d.getDate()).padStart(2, '0');
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const year = d.getFullYear();
            dateStr = `${day}/${month}/${year}`;
          }
        } else if (date instanceof Date) {
          const day = String(date.getDate()).padStart(2, '0');
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const year = date.getFullYear();
          dateStr = `${day}/${month}/${year}`;
        } else {
          return '';
        }
        
        const digits = dateStr.replace(/\//g, '').split('');
        
        if (format === 'DD/MM/YYYY') {
          return digits.slice(0, 8).map(digit => 
            `<span class="date-box">${digit}</span>`
          ).join('');
        } else if (format === 'DD/MM/YY') {
          return digits.slice(0, 6).map(digit => 
            `<span class="date-box">${digit}</span>`
          ).join('');
        }
        
        return '';
      } catch (error) {
        console.error('Error splitting date:', error);
        return '';
      }
    });
    
    Handlebars.registerHelper('checkbox', function(value: any, expectedValue: any) {
      const isChecked = value === expectedValue || value === true || 
                       (typeof value === 'string' && value.toLowerCase() === 'yes') ||
                       (typeof expectedValue === 'string' && expectedValue.toLowerCase() === 'yes' && value === true);
      return isChecked ? 'checkbox--checked' : '';
    });
  }
  
  /**
   * Render HTML template with form data
   */
  async renderTemplate(
    vendorCode: string,
    formData: Record<string, any>
  ): Promise<string> {
    const normalizedVendorCode = vendorCode.toLowerCase();
    const templateFileName = `${normalizedVendorCode}-emaf.hbs`;
    const templatePath = join(this.templatesPath, templateFileName);
    
    try {
      console.log(`Loading template from: ${templatePath}`);
      
      const templateSource = readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateSource);
      
      const templateData = {
        ...formData,
        generatedDate: new Date().toLocaleDateString('en-GB'),
        generatedDateTime: new Date().toLocaleString('en-GB'),
        currentYear: new Date().getFullYear(),
        hasInsuredMembers: formData.insuredMembers && formData.insuredMembers.length > 0,
        hasMedicalQuestions: formData.medicalQuestions && formData.medicalQuestions.length > 0,
        hasPreviousInsurance: formData.previousInsurance && formData.previousInsurance.length > 0,
      };
      
      const html = template(templateData);
      
      console.log(`Template rendered successfully for vendor: ${normalizedVendorCode}`);
      
      return html;
    } catch (error: any) {
      console.error(`Failed to render template for ${normalizedVendorCode}:`, error);
      throw new Error(`Template rendering failed: ${error.message}`);
    }
  }
  
  /**
   * Check if template exists for vendor
   */
  templateExists(vendorCode: string): boolean {
    const normalizedVendorCode = vendorCode.toLowerCase();
    const templateFileName = `${normalizedVendorCode}-emaf.hbs`;
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

export const templateRenderer = new TemplateRenderer();
