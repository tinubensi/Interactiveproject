/**
 * Validation utilities for EMAF Service
 */

import { EmafTemplate, EmafSubmission, DocumentRequirement } from '../models/emafTypes';

/**
 * Validate EMAF template
 */
export function validateEmafTemplate(template: Partial<EmafTemplate>): string[] {
  const errors: string[] = [];

  if (!template.vendorId) {
    errors.push('vendorId is required');
  }

  if (!template.vendorName) {
    errors.push('vendorName is required');
  }

  if (!template.name) {
    errors.push('name is required');
  }

  if (!template.sections || template.sections.length === 0) {
    errors.push('At least one section is required');
  }

  if (template.sections) {
    template.sections.forEach((section, index) => {
      if (!section.title) {
        errors.push(`Section ${index + 1} must have a title`);
      }
      if (!section.questions || section.questions.length === 0) {
        errors.push(`Section ${index + 1} must have at least one question`);
      }
    });
  }

  return errors;
}

/**
 * Validate document requirement
 */
export function validateDocumentRequirement(doc: DocumentRequirement): string[] {
  const errors: string[] = [];

  if (!doc.id) {
    errors.push('Document requirement id is required');
  }

  if (!doc.documentType) {
    errors.push('Document type is required');
  }

  if (!doc.label) {
    errors.push('Document label is required');
  }

  if (!doc.acceptedFormats || doc.acceptedFormats.length === 0) {
    errors.push('At least one accepted format is required');
  }

  if (!doc.maxSizeInMB || doc.maxSizeInMB <= 0) {
    errors.push('Max size must be greater than 0');
  }

  return errors;
}

/**
 * Validate submission form data
 */
export function validateSubmissionFormData(
  formData: Record<string, any>,
  template: EmafTemplate
): string[] {
  const errors: string[] = [];

  // Check if all required fields are filled
  template.sections.forEach((section) => {
    section.questions.forEach((question) => {
      if (question.validation?.required) {
        const value = formData[question.dataKey];
        if (value === undefined || value === null || value === '') {
          errors.push(`${question.label} is required`);
        }
      }
    });
  });

  return errors;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format
 */
export function isValidPhone(phone: string): boolean {
  // Basic phone validation (can be enhanced)
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.length >= 7;
}

/**
 * Sanitize file name
 */
export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Validate file size
 */
export function isFileSizeValid(sizeInBytes: number, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return sizeInBytes <= maxSizeInBytes;
}

/**
 * Validate file type
 */
export function isFileTypeValid(fileName: string, acceptedFormats: string[]): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase();
  if (!extension) return false;
  
  return acceptedFormats.map(f => f.toLowerCase()).includes(extension);
}
