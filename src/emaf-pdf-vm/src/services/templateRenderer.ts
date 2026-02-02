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
    
    Handlebars.registerHelper('or', function(a: any, b: any) {
      return a || b;
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
      // Handle undefined/null values
      if (value === undefined || value === null) {
        return '';
      }
      
      // Normalize both value and expectedValue to lowercase strings
      const normalizedValue = String(value).toLowerCase();
      const normalizedExpected = String(expectedValue).toLowerCase();
      
      // Check for match
      if (normalizedValue === normalizedExpected) {
        return 'checkbox--checked';
      }
      
      // Handle boolean true/false
      if (typeof value === 'boolean') {
        if (value === true && normalizedExpected === 'yes') {
          return 'checkbox--checked';
        }
        if (value === false && normalizedExpected === 'no') {
          return 'checkbox--checked';
        }
      }
      
      return '';
    });
    
    // Helper to check salary value (supports both nested and flat formats)
    Handlebars.registerHelper('checkSalary', function(this: any, expectedValue: string) {
      // 'this' refers to the current context in Handlebars
      const salary = this?.policyHolder?.salary || this?.policyHolder_salary;
      return salary === expectedValue;
    });
  }
  
  /**
   * Transform flat form data keys to nested structure
   * Converts: policyHolder_fullName -> policyHolder.fullName
   * Also handles members array format and already-nested objects
   * Keys are already in camelCase format after the underscore
   */
  private transformFlatToNested(formData: Record<string, any>): Record<string, any> {
    const transformed: Record<string, any> = {};
    
    // Group fields by prefix (policyHolder_, principal_, spouse_, dependent1-5_)
    const groups: Record<string, Record<string, any>> = {};
    
    // Handle members array format (from Sukoon-style forms)
    if (formData.members && Array.isArray(formData.members)) {
      const members = formData.members;
      
      // Principal is typically the first member with relationship 'Self'
      const principalMember = members.find((m: any) => 
        m.relationship && (m.relationship.toLowerCase() === 'self' || m.relationship.toLowerCase() === 'principal')
      ) || members[0];
      
      if (principalMember) {
        groups.principal = {
          name: principalMember.name || '',
          gender: principalMember.gender || '',
          maritalStatus: principalMember.maritalStatus || '',
          relation: principalMember.relationship || 'self',
          dob: principalMember.dateOfBirth || principalMember.dob || '',
          height: principalMember.height || '',
          weight: principalMember.weight || ''
        };
      }
      
      // Spouse is typically a member with relationship 'Spouse'
      const spouseMember = members.find((m: any) => 
        m.relationship && m.relationship.toLowerCase() === 'spouse'
      );
      
      if (spouseMember) {
        groups.spouse = {
          name: spouseMember.name || '',
          gender: spouseMember.gender || '',
          maritalStatus: spouseMember.maritalStatus || '',
          relation: spouseMember.relationship || 'spouse',
          dob: spouseMember.dateOfBirth || spouseMember.dob || '',
          height: spouseMember.height || '',
          weight: spouseMember.weight || ''
        };
      }
      
      // Dependents are members with other relationships
      const dependentMembers = members.filter((m: any, index: number) => {
        if (!m.relationship) return false;
        const rel = m.relationship.toLowerCase();
        return rel !== 'self' && rel !== 'principal' && rel !== 'spouse';
      });
      
      dependentMembers.forEach((member: any, index: number) => {
        const depNum = index + 1;
        if (depNum <= 5) {
          groups[`dependent${depNum}`] = {
            name: member.name || '',
            gender: member.gender || '',
            maritalStatus: member.maritalStatus || '',
            relation: member.relationship || '',
            dob: member.dateOfBirth || member.dob || '',
            height: member.height || '',
            weight: member.weight || ''
          };
        }
      });
    }
    
    // Handle flat keys (policyHolder_name, spouse_name, dependent1_name, etc.)
    Object.keys(formData).forEach(key => {
      const parts = key.split('_');
      if (parts.length >= 2) {
        const prefix = parts[0];
        const suffix = parts.slice(1).join('_'); // Keep camelCase as-is
        
        // Handle special cases
        if (prefix === 'policyHolder') {
          if (!groups.policyHolder) groups.policyHolder = {};
          groups.policyHolder[suffix] = formData[key];
        } else if (prefix === 'principal') {
          if (!groups.principal) groups.principal = {};
          groups.principal[suffix] = formData[key];
        } else if (prefix === 'spouse') {
          if (!groups.spouse) groups.spouse = {};
          groups.spouse[suffix] = formData[key];
        } else if (prefix.startsWith('dependent') && /^dependent\d+$/.test(prefix)) {
          if (!groups[prefix]) groups[prefix] = {};
          groups[prefix][suffix] = formData[key];
        } else {
          // Keep other keys as-is
          transformed[key] = formData[key];
        }
      } else {
        // Keys without underscore stay as-is (but preserve nested objects)
        if (key === 'members' || key === 'policyHolder' || key === 'principal' || 
            key === 'spouse' || /^dependent\d+$/.test(key)) {
          // These are handled separately, skip
        } else {
          transformed[key] = formData[key];
        }
      }
    });
    
    // Preserve already-nested objects if they exist
    if (formData.principal && typeof formData.principal === 'object') {
      groups.principal = { ...groups.principal, ...formData.principal };
    }
    if (formData.spouse && typeof formData.spouse === 'object') {
      groups.spouse = { ...groups.spouse, ...formData.spouse };
    }
    for (let i = 1; i <= 5; i++) {
      const depKey = `dependent${i}`;
      if (formData[depKey] && typeof formData[depKey] === 'object') {
        groups[depKey] = { ...groups[depKey], ...formData[depKey] };
      }
    }
    
    // Add grouped fields to transformed object
    Object.keys(groups).forEach(groupKey => {
      transformed[groupKey] = groups[groupKey];
    });
    
    return transformed;
  }
  
  /**
   * Render HTML template with form data
   * @param vendorCode - Vendor code (e.g., 'alsagr')
   * @param formData - Form submission data
   * @param leadData - Optional lead data for additional prefilling (e.g., salary)
   */
  async renderTemplate(
    vendorCode: string,
    formData: Record<string, any>,
    leadData?: any
  ): Promise<string> {
    const normalizedVendorCode = vendorCode.toLowerCase();
    const templateFileName = `${normalizedVendorCode}-emaf.hbs`;
    const templatePath = join(this.templatesPath, templateFileName);
    
    try {
      console.log(`Loading template from: ${templatePath}`);
      
      const templateSource = readFileSync(templatePath, 'utf-8');
      const template = Handlebars.compile(templateSource);
      
      // Transform flat keys to nested structure
      const transformedData = this.transformFlatToNested(formData);
      
      // Handle salary field - check multiple possible locations
      let salaryValue = transformedData.policyHolder?.salary || 
                       formData.policyHolder_salary ||
                       formData.memberDetails?.salary ||
                       formData.salary;
      
      // If salary not found in formData, try to extract from leadData
      if (!salaryValue && leadData) {
        // Check leadData.lobData.salary or leadData.lobData.salaryRange
        const lobData = leadData.lobData || leadData.lob || {};
        salaryValue = lobData.salary || lobData.salaryRange;
        
        console.log('   Extracting salary from leadData:', {
          lobData: lobData,
          salary: lobData.salary,
          salaryRange: lobData.salaryRange
        });
      }
      
      // Normalize salary value
      if (salaryValue) {
        const salaryStr = String(salaryValue).toLowerCase();
        
        // Handle numeric values
        if (typeof salaryValue === 'number') {
          salaryValue = salaryValue <= 4000 ? 'up_to_4000' : 'above_4000';
        } else if (typeof salaryValue === 'string') {
          // Handle string values
          if (salaryStr.includes('4000') && (salaryStr.includes('below') || salaryStr.includes('up') || salaryStr.includes('less') || salaryStr.includes('to'))) {
            salaryValue = 'up_to_4000';
          } else if (salaryStr.includes('4001') || salaryStr.includes('above') || salaryStr.includes('more')) {
            salaryValue = 'above_4000';
          } else if (salaryStr.includes('5000') && salaryStr.includes('less')) {
            // "Less than 5000" maps to "up_to_4000"
            salaryValue = 'up_to_4000';
          } else {
            // Try to parse as number
            const numMatch = salaryStr.match(/\d+/);
            if (numMatch) {
              const num = parseInt(numMatch[0]);
              salaryValue = num <= 4000 ? 'up_to_4000' : 'above_4000';
            }
          }
        }
      }
      
      // Ensure policyHolder object exists and has salary
      if (!transformedData.policyHolder) {
        transformedData.policyHolder = {};
      }
      if (salaryValue) {
        transformedData.policyHolder.salary = salaryValue;
      }
      
      const templateData = {
        ...transformedData,
        ...formData, // Keep original flat keys for backward compatibility
        policyHolder_salary: salaryValue || formData.policyHolder_salary, // Ensure flat key also exists
        generatedDate: new Date().toLocaleDateString('en-GB'),
        generatedDateTime: new Date().toLocaleString('en-GB'),
        currentYear: new Date().getFullYear(),
        hasInsuredMembers: formData.insuredMembers && formData.insuredMembers.length > 0,
        hasMedicalQuestions: formData.medicalQuestions && formData.medicalQuestions.length > 0,
        hasPreviousInsurance: formData.previousInsurance && formData.previousInsurance.length > 0,
      };
      
      // Debug logging
      console.log('Template data keys:', Object.keys(templateData));
      console.log('Principal data:', (templateData as any).principal);
      console.log('Spouse data:', (templateData as any).spouse);
      console.log('Dependent1 data:', (templateData as any).dependent1);
      console.log('Salary value:', salaryValue);
      console.log('PolicyHolder salary:', (templateData as any).policyHolder?.salary);
      
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
