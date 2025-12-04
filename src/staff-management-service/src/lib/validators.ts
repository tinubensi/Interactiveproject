/**
 * Validation Helpers for Staff Management Service
 */

import { StaffStatus, STATUS_TRANSITIONS, License } from '../models/StaffMember';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate status transition
 */
export function validateStatusTransition(
  currentStatus: StaffStatus,
  targetStatus: StaffStatus
): ValidationResult {
  const errors: string[] = [];

  if (currentStatus === targetStatus) {
    errors.push(`Status is already ${currentStatus}`);
  } else {
    const allowedTransitions = STATUS_TRANSITIONS[currentStatus];
    if (!allowedTransitions.includes(targetStatus)) {
      errors.push(
        `Cannot transition from ${currentStatus} to ${targetStatus}. ` +
        `Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate license dates
 */
export function validateLicense(license: License): ValidationResult {
  const errors: string[] = [];

  // Validate required fields
  if (!license.licenseType) {
    errors.push('License type is required');
  }
  if (!license.licenseNumber) {
    errors.push('License number is required');
  }
  if (!license.issuingAuthority) {
    errors.push('Issuing authority is required');
  }
  if (!license.issueDate) {
    errors.push('Issue date is required');
  }
  if (!license.expiryDate) {
    errors.push('Expiry date is required');
  }

  // Validate dates
  if (license.issueDate && license.expiryDate) {
    const issueDate = new Date(license.issueDate);
    const expiryDate = new Date(license.expiryDate);

    if (isNaN(issueDate.getTime())) {
      errors.push('Invalid issue date format');
    }
    if (isNaN(expiryDate.getTime())) {
      errors.push('Invalid expiry date format');
    }
    if (issueDate >= expiryDate) {
      errors.push('Issue date must be before expiry date');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  const errors: string[] = [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    errors.push('Email is required');
  } else if (!emailRegex.test(email)) {
    errors.push('Invalid email format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Validate phone number format (basic validation)
 */
export function validatePhone(phone: string): ValidationResult {
  const errors: string[] = [];
  // Basic phone validation - should start with + and have at least 10 digits
  const phoneRegex = /^\+?[\d\s-]{10,}$/;

  if (!phone) {
    errors.push('Phone number is required');
  } else if (!phoneRegex.test(phone)) {
    errors.push('Invalid phone number format');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a license is expired
 */
export function isLicenseExpired(license: License): boolean {
  const expiryDate = new Date(license.expiryDate);
  const now = new Date();
  return expiryDate < now;
}

/**
 * Get days until license expiry
 */
export function getDaysUntilExpiry(license: License): number {
  const expiryDate = new Date(license.expiryDate);
  const now = new Date();
  const diffTime = expiryDate.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Check if license needs renewal alert
 * Returns the current alert threshold day if within any alert range
 */
export function needsRenewalAlert(license: License, alertDays: number[]): number | null {
  const daysUntilExpiry = getDaysUntilExpiry(license);
  
  if (daysUntilExpiry <= 0) {
    return null; // Already expired
  }

  // Sort alert days ascending to find the correct threshold
  const sortedDays = [...alertDays].sort((a, b) => a - b);
  
  // Find the smallest alert day that is >= daysUntilExpiry
  for (const alertDay of sortedDays) {
    if (daysUntilExpiry <= alertDay) {
      return alertDay;
    }
  }
  
  return null; // Not within any alert range
}

/**
 * Validate create staff request
 */
export function validateCreateStaffRequest(request: {
  azureAdId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  employeeId?: string;
  jobTitle?: string;
  department?: string;
  staffType?: string;
  hireDate?: string;
  teamIds?: string[];
  licenses?: License[];
}): ValidationResult {
  const errors: string[] = [];

  if (!request.azureAdId) {
    errors.push('Azure AD ID is required');
  }
  if (!request.email) {
    errors.push('Email is required');
  } else {
    const emailValidation = validateEmail(request.email);
    errors.push(...emailValidation.errors);
  }
  if (!request.firstName) {
    errors.push('First name is required');
  }
  if (!request.lastName) {
    errors.push('Last name is required');
  }
  if (!request.phone) {
    errors.push('Phone is required');
  } else {
    const phoneValidation = validatePhone(request.phone);
    errors.push(...phoneValidation.errors);
  }
  if (!request.employeeId) {
    errors.push('Employee ID is required');
  }
  if (!request.jobTitle) {
    errors.push('Job title is required');
  }
  if (!request.department) {
    errors.push('Department is required');
  }
  if (!request.staffType) {
    errors.push('Staff type is required');
  }
  if (!request.hireDate) {
    errors.push('Hire date is required');
  }
  if (!request.teamIds || request.teamIds.length === 0) {
    errors.push('At least one team is required');
  }

  // Validate licenses if provided
  if (request.licenses) {
    for (let i = 0; i < request.licenses.length; i++) {
      const licenseValidation = validateLicense(request.licenses[i]);
      if (!licenseValidation.valid) {
        errors.push(`License ${i + 1}: ${licenseValidation.errors.join(', ')}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

