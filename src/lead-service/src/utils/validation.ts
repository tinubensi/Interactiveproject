/**
 * Validation Utilities
 * Input validation for lead operations
 * Reference: Petli validation logic
 */

import { CreateLeadRequest, UpdateLeadRequest, LineOfBusiness, BusinessType } from '../models/lead';

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format
 */
export function isValidPhone(phone: string): boolean {
  // Basic validation - adjust based on requirements
  const phoneRegex = /^\+?[\d\s()-]{10,}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate line of business
 */
export function isValidLineOfBusiness(lob: string): lob is LineOfBusiness {
  return ['medical', 'motor', 'general', 'marine'].includes(lob);
}

/**
 * Validate business type
 */
export function isValidBusinessType(type: string): type is BusinessType {
  return ['individual', 'group'].includes(type);
}

/**
 * Validate date format (ISO format: YYYY-MM-DD)
 */
export function isValidDateFormat(date: string): boolean {
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!isoDateRegex.test(date)) return false;
  
  // Check if it's a valid date
  const dateObj = new Date(date);
  return dateObj instanceof Date && !isNaN(dateObj.getTime());
}

/**
 * Validate create lead request
 */
export function validateCreateLeadRequest(request: CreateLeadRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!request.lineOfBusiness) {
    errors.push('lineOfBusiness is required');
  } else if (!isValidLineOfBusiness(request.lineOfBusiness)) {
    errors.push('Invalid lineOfBusiness. Must be: medical, motor, general, or marine');
  }

  if (!request.businessType) {
    errors.push('businessType is required');
  } else if (!isValidBusinessType(request.businessType)) {
    errors.push('Invalid businessType. Must be: individual or group');
  }

  if (!request.customerId) {
    errors.push('customerId is required');
  }

  if (!request.firstName) {
    errors.push('firstName is required');
  }

  if (!request.lastName) {
    errors.push('lastName is required');
  }

  if (!request.email) {
    errors.push('email is required');
  } else if (!isValidEmail(request.email)) {
    errors.push('Invalid email format');
  }

  if (!request.phone || !request.phone.number) {
    errors.push('phone number is required');
  } else if (!isValidPhone(request.phone.number)) {
    errors.push('Invalid phone number format');
  }

  if (!request.emirate) {
    errors.push('emirate is required');
  }

  if (!request.lobData) {
    errors.push('lobData is required');
  } else {
    // Validate LOB-specific data
    const lobErrors = validateLOBData(request.lineOfBusiness, request.businessType, request.lobData);
    errors.push(...lobErrors);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate LOB-specific data
 */
function validateLOBData(lob: LineOfBusiness, businessType: BusinessType, lobData: any): string[] {
  const errors: string[] = [];

  switch (lob) {
    case 'medical':
      // Human health insurance validation
      if (!lobData.dateOfBirth) errors.push('dateOfBirth is required for medical insurance');
      if (!lobData.gender) errors.push('gender is required for medical insurance');
      if (!lobData.nationality) errors.push('nationality is required for medical insurance');
      
      // Validate gender if provided
      if (lobData.gender && !['Male', 'Female'].includes(lobData.gender)) {
        errors.push('gender must be either "Male" or "Female"');
      }
      
      // Validate date of birth format if provided
      if (lobData.dateOfBirth && !isValidDateFormat(lobData.dateOfBirth)) {
        errors.push('dateOfBirth must be in ISO format (YYYY-MM-DD)');
      }
      
      // Family coverage validation
      if (lobData.coverageType === 'Family') {
        if (!lobData.numberOfDependents || lobData.numberOfDependents < 1) {
          errors.push('numberOfDependents is required for Family coverage');
        }
        if (!lobData.dependents || !Array.isArray(lobData.dependents) || lobData.dependents.length === 0) {
          errors.push('dependents array is required for Family coverage');
        }
      }
      break;

    case 'motor':
      if (businessType === 'individual') {
        if (!lobData.vehicleType) errors.push('vehicleType is required for motor individual');
        if (!lobData.make) errors.push('make is required for motor individual');
        if (!lobData.model) errors.push('model is required for motor individual');
        if (!lobData.year) errors.push('year is required for motor individual');
      } else if (businessType === 'group') {
        if (!lobData.numberOfVehicles) errors.push('numberOfVehicles is required for motor group');
        if (!lobData.vehicles || !Array.isArray(lobData.vehicles) || lobData.vehicles.length === 0) {
          errors.push('vehicles array is required for motor group');
        }
      }
      break;

    case 'general':
      if (businessType === 'individual') {
        if (!lobData.propertyType) errors.push('propertyType is required for general individual');
        if (!lobData.propertyValue) errors.push('propertyValue is required for general individual');
      } else if (businessType === 'group') {
        if (!lobData.numberOfProperties) errors.push('numberOfProperties is required for general group');
      }
      break;

    case 'marine':
      if (!lobData.cargoType && !lobData.vesselType && !lobData.yachtType) {
        errors.push('At least one of cargoType, vesselType, or yachtType is required for marine');
      }
      break;
  }

  return errors;
}

/**
 * Validate update lead request
 */
export function validateUpdateLeadRequest(request: UpdateLeadRequest): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (request.email && !isValidEmail(request.email)) {
    errors.push('Invalid email format');
  }

  if (request.phone && request.phone.number && !isValidPhone(request.phone.number)) {
    errors.push('Invalid phone number format');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Sanitize input (lowercase, trim)
 */
export function sanitizeInput(input: string): string {
  return input.trim().toLowerCase();
}

/**
 * Capitalize name
 */
export function capitalizeName(name: string): string {
  return name.trim().split(' ').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}


