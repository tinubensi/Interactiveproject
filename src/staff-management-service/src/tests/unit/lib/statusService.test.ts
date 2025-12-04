/**
 * Status Service Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  applyStatusChange,
  calculateAvailability,
  canAcceptAssignments,
  requiresWorkloadReassignment,
  getStatusLabel,
  validateStatusRestrictions,
} from '../../../lib/statusService';
import { StaffMemberDocument } from '../../../models/StaffMember';

const createMockStaff = (overrides: Partial<StaffMemberDocument> = {}): StaffMemberDocument => ({
  id: 'staff-1',
  staffId: 'staff-1',
  azureAdId: 'azure-1',
  email: 'test@example.com',
  firstName: 'John',
  lastName: 'Doe',
  displayName: 'John Doe',
  phone: '+971501234567',
  employeeId: 'EMP001',
  jobTitle: 'Broker',
  department: 'Sales',
  staffType: 'broker',
  hireDate: '2025-01-01',
  status: 'active',
  statusChangedAt: '2025-01-01T00:00:00Z',
  teamIds: ['team-1'],
  organizationId: 'org-1',
  territories: ['dubai'],
  workload: {
    activeLeads: 5,
    activeCustomers: 20,
    activePolicies: 15,
    pendingApprovals: 2,
  },
  availability: {
    isAvailable: true,
  },
  notificationPreferences: {
    email: true,
    sms: false,
    push: true,
    channels: {
      approvals: true,
      assignments: true,
      alerts: true,
      marketing: false,
    },
  },
  createdAt: '2025-01-01T00:00:00Z',
  createdBy: 'admin',
  updatedAt: '2025-01-01T00:00:00Z',
  updatedBy: 'admin',
  ...overrides,
});

describe('statusService', () => {
  describe('applyStatusChange', () => {
    it('should apply valid status change', () => {
      const staff = createMockStaff({ status: 'active' });
      const result = applyStatusChange(staff, 'on_leave', 'Vacation');
      
      assert.strictEqual(result.previousStatus, 'active');
      assert.strictEqual(result.currentStatus, 'on_leave');
      assert.strictEqual(result.reason, 'Vacation');
      assert.ok(result.statusChangedAt);
    });

    it('should set availability to false when going on_leave', () => {
      const staff = createMockStaff({ status: 'active' });
      const result = applyStatusChange(staff, 'on_leave', 'Vacation', '2025-12-31');
      
      assert.strictEqual(result.availability.isAvailable, false);
      assert.strictEqual(result.availability.awayUntil, '2025-12-31');
    });

    it('should throw error for invalid transition', () => {
      const staff = createMockStaff({ status: 'terminated' });
      
      assert.throws(
        () => applyStatusChange(staff, 'active'),
        /Cannot transition/
      );
    });
  });

  describe('calculateAvailability', () => {
    it('should return available for active status', () => {
      const result = calculateAvailability('active');
      assert.strictEqual(result.isAvailable, true);
      assert.strictEqual(result.awayUntil, undefined);
    });

    it('should return unavailable for on_leave status', () => {
      const result = calculateAvailability('on_leave', '2025-12-31', 'Vacation');
      assert.strictEqual(result.isAvailable, false);
      assert.strictEqual(result.awayUntil, '2025-12-31');
      assert.strictEqual(result.awayReason, 'Vacation');
    });

    it('should return unavailable for suspended status', () => {
      const result = calculateAvailability('suspended');
      assert.strictEqual(result.isAvailable, false);
      assert.ok(result.awayReason?.includes('suspended'));
    });

    it('should return unavailable for terminated status', () => {
      const result = calculateAvailability('terminated');
      assert.strictEqual(result.isAvailable, false);
    });
  });

  describe('canAcceptAssignments', () => {
    it('should return true for active status', () => {
      assert.strictEqual(canAcceptAssignments('active'), true);
    });

    it('should return false for inactive status', () => {
      assert.strictEqual(canAcceptAssignments('inactive'), false);
    });

    it('should return false for on_leave status', () => {
      assert.strictEqual(canAcceptAssignments('on_leave'), false);
    });

    it('should return false for suspended status', () => {
      assert.strictEqual(canAcceptAssignments('suspended'), false);
    });

    it('should return false for terminated status', () => {
      assert.strictEqual(canAcceptAssignments('terminated'), false);
    });
  });

  describe('requiresWorkloadReassignment', () => {
    it('should return true when going from active to inactive', () => {
      assert.strictEqual(requiresWorkloadReassignment('active', 'inactive'), true);
    });

    it('should return true when going from active to on_leave', () => {
      assert.strictEqual(requiresWorkloadReassignment('active', 'on_leave'), true);
    });

    it('should return true when going from active to terminated', () => {
      assert.strictEqual(requiresWorkloadReassignment('active', 'terminated'), true);
    });

    it('should return false when going from inactive to active', () => {
      assert.strictEqual(requiresWorkloadReassignment('inactive', 'active'), false);
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct label for active', () => {
      assert.strictEqual(getStatusLabel('active'), 'Active');
    });

    it('should return correct label for on_leave', () => {
      assert.strictEqual(getStatusLabel('on_leave'), 'On Leave');
    });

    it('should return correct label for terminated', () => {
      assert.strictEqual(getStatusLabel('terminated'), 'Terminated');
    });
  });

  describe('validateStatusRestrictions', () => {
    it('should pass for active and available staff', () => {
      const staff = createMockStaff({
        status: 'active',
        availability: { isAvailable: true },
      });
      const result = validateStatusRestrictions(staff, 'assign_lead');
      assert.strictEqual(result.valid, true);
    });

    it('should fail for inactive staff', () => {
      const staff = createMockStaff({ status: 'inactive' });
      const result = validateStatusRestrictions(staff, 'assign_lead');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('Inactive')));
    });

    it('should fail for unavailable staff', () => {
      const staff = createMockStaff({
        status: 'active',
        availability: { isAvailable: false, awayReason: 'On vacation' },
      });
      const result = validateStatusRestrictions(staff, 'assign_customer');
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('vacation')));
    });
  });
});

