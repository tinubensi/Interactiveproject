/**
 * Validators Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateStatusTransition,
  validateLicense,
  validateEmail,
  validatePhone,
  isLicenseExpired,
  getDaysUntilExpiry,
  needsRenewalAlert,
  validateCreateStaffRequest,
} from '../../../lib/validators';
import { License } from '../../../models/StaffMember';

describe('validators', () => {
  describe('validateStatusTransition', () => {
    it('should allow active → inactive', () => {
      const result = validateStatusTransition('active', 'inactive');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should allow active → on_leave', () => {
      const result = validateStatusTransition('active', 'on_leave');
      assert.strictEqual(result.valid, true);
    });

    it('should allow active → suspended', () => {
      const result = validateStatusTransition('active', 'suspended');
      assert.strictEqual(result.valid, true);
    });

    it('should allow active → terminated', () => {
      const result = validateStatusTransition('active', 'terminated');
      assert.strictEqual(result.valid, true);
    });

    it('should allow on_leave → active', () => {
      const result = validateStatusTransition('on_leave', 'active');
      assert.strictEqual(result.valid, true);
    });

    it('should allow inactive → active', () => {
      const result = validateStatusTransition('inactive', 'active');
      assert.strictEqual(result.valid, true);
    });

    it('should allow suspended → active', () => {
      const result = validateStatusTransition('suspended', 'active');
      assert.strictEqual(result.valid, true);
    });

    it('should reject terminated → active', () => {
      const result = validateStatusTransition('terminated', 'active');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('Cannot transition'));
    });

    it('should reject same status', () => {
      const result = validateStatusTransition('active', 'active');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('already'));
    });

    it('should reject invalid transitions', () => {
      const result = validateStatusTransition('on_leave', 'suspended');
      assert.strictEqual(result.valid, false);
    });
  });

  describe('validateLicense', () => {
    const validLicense: License = {
      licenseType: 'insurance_broker',
      licenseNumber: 'IB-2025-001',
      issuingAuthority: 'UAE Insurance Authority',
      issueDate: '2025-01-01',
      expiryDate: '2026-01-01',
      status: 'active',
    };

    it('should validate a valid license', () => {
      const result = validateLicense(validLicense);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should require license type', () => {
      const result = validateLicense({ ...validLicense, licenseType: '' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('License type')));
    });

    it('should require license number', () => {
      const result = validateLicense({ ...validLicense, licenseNumber: '' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('License number')));
    });

    it('should require issuing authority', () => {
      const result = validateLicense({ ...validLicense, issuingAuthority: '' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Issuing authority')));
    });

    it('should require issue date', () => {
      const result = validateLicense({ ...validLicense, issueDate: '' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Issue date')));
    });

    it('should require expiry date', () => {
      const result = validateLicense({ ...validLicense, expiryDate: '' });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Expiry date')));
    });

    it('should reject issue date after expiry date', () => {
      const result = validateLicense({
        ...validLicense,
        issueDate: '2026-01-01',
        expiryDate: '2025-01-01',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('before expiry')));
    });

    it('should reject invalid date formats', () => {
      const result = validateLicense({
        ...validLicense,
        issueDate: 'not-a-date',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Invalid')));
    });
  });

  describe('validateEmail', () => {
    it('should validate a valid email', () => {
      const result = validateEmail('user@example.com');
      assert.strictEqual(result.valid, true);
    });

    it('should reject empty email', () => {
      const result = validateEmail('');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('required'));
    });

    it('should reject invalid email format', () => {
      const result = validateEmail('not-an-email');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('Invalid'));
    });

    it('should reject email without domain', () => {
      const result = validateEmail('user@');
      assert.strictEqual(result.valid, false);
    });
  });

  describe('validatePhone', () => {
    it('should validate a valid phone number', () => {
      const result = validatePhone('+971501234567');
      assert.strictEqual(result.valid, true);
    });

    it('should validate phone with spaces', () => {
      const result = validatePhone('+971 50 123 4567');
      assert.strictEqual(result.valid, true);
    });

    it('should reject empty phone', () => {
      const result = validatePhone('');
      assert.strictEqual(result.valid, false);
    });

    it('should reject short phone number', () => {
      const result = validatePhone('12345');
      assert.strictEqual(result.valid, false);
    });
  });

  describe('isLicenseExpired', () => {
    it('should return true for expired license', () => {
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2020-01-01',
        expiryDate: '2021-01-01',
        status: 'active',
      };
      assert.strictEqual(isLicenseExpired(license), true);
    });

    it('should return false for valid license', () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2024-01-01',
        expiryDate: futureDate.toISOString().split('T')[0],
        status: 'active',
      };
      assert.strictEqual(isLicenseExpired(license), false);
    });
  });

  describe('getDaysUntilExpiry', () => {
    it('should return positive days for future expiry', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2024-01-01',
        expiryDate: futureDate.toISOString().split('T')[0],
        status: 'active',
      };
      
      const days = getDaysUntilExpiry(license);
      assert.ok(days >= 29 && days <= 31);
    });

    it('should return negative days for expired license', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 10);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2020-01-01',
        expiryDate: pastDate.toISOString().split('T')[0],
        status: 'active',
      };
      
      const days = getDaysUntilExpiry(license);
      assert.ok(days < 0);
    });
  });

  describe('needsRenewalAlert', () => {
    const alertDays = [30, 14, 7, 3, 1];

    it('should return 30 for license expiring in 25 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 25);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2024-01-01',
        expiryDate: futureDate.toISOString().split('T')[0],
        status: 'active',
      };
      
      assert.strictEqual(needsRenewalAlert(license, alertDays), 30);
    });

    it('should return 14 for license expiring in 10 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2024-01-01',
        expiryDate: futureDate.toISOString().split('T')[0],
        status: 'active',
      };
      
      assert.strictEqual(needsRenewalAlert(license, alertDays), 14);
    });

    it('should return null for license expiring in 60 days', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 60);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2024-01-01',
        expiryDate: futureDate.toISOString().split('T')[0],
        status: 'active',
      };
      
      assert.strictEqual(needsRenewalAlert(license, alertDays), null);
    });

    it('should return null for expired license', () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 5);
      
      const license: License = {
        licenseType: 'test',
        licenseNumber: 'TEST-001',
        issuingAuthority: 'Test Authority',
        issueDate: '2020-01-01',
        expiryDate: pastDate.toISOString().split('T')[0],
        status: 'active',
      };
      
      assert.strictEqual(needsRenewalAlert(license, alertDays), null);
    });
  });

  describe('validateCreateStaffRequest', () => {
    const validRequest = {
      azureAdId: 'azure-123',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+971501234567',
      employeeId: 'EMP001',
      jobTitle: 'Insurance Broker',
      department: 'Sales',
      staffType: 'broker',
      hireDate: '2025-01-15',
      teamIds: ['team-1'],
    };

    it('should validate a valid request', () => {
      const result = validateCreateStaffRequest(validRequest);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should require azureAdId', () => {
      const result = validateCreateStaffRequest({ ...validRequest, azureAdId: undefined });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Azure AD')));
    });

    it('should require email', () => {
      const result = validateCreateStaffRequest({ ...validRequest, email: undefined });
      assert.strictEqual(result.valid, false);
    });

    it('should require firstName', () => {
      const result = validateCreateStaffRequest({ ...validRequest, firstName: undefined });
      assert.strictEqual(result.valid, false);
    });

    it('should require at least one team', () => {
      const result = validateCreateStaffRequest({ ...validRequest, teamIds: [] });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('team')));
    });

    it('should validate licenses if provided', () => {
      const result = validateCreateStaffRequest({
        ...validRequest,
        licenses: [
          {
            licenseType: '',
            licenseNumber: 'TEST-001',
            issuingAuthority: 'Test',
            issueDate: '2025-01-01',
            expiryDate: '2026-01-01',
            status: 'active' as const,
          },
        ],
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('License')));
    });
  });
});

