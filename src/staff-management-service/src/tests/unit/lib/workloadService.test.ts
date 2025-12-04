/**
 * Workload Service Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateLeadUtilization,
  calculateCustomerUtilization,
  calculateOverallUtilization,
  getWorkloadStatus,
  canAcceptNewLead,
  canAcceptNewCustomer,
  getWorkloadBreakdown,
  getWorkloadInfo,
  incrementWorkload,
  decrementWorkload,
} from '../../../lib/workloadService';
import { StaffMemberDocument } from '../../../models/StaffMember';

const createMockStaff = (workloadOverrides = {}): StaffMemberDocument => ({
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
    activeLeads: 10,
    activeCustomers: 30,
    activePolicies: 25,
    pendingApprovals: 2,
    maxLeads: 20,
    maxCustomers: 60,
    ...workloadOverrides,
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
});

describe('workloadService', () => {
  describe('calculateLeadUtilization', () => {
    it('should calculate correct utilization', () => {
      const staff = createMockStaff({ activeLeads: 10, maxLeads: 20 });
      const utilization = calculateLeadUtilization(staff.workload);
      assert.strictEqual(utilization, 0.5);
    });

    it('should use default max when maxLeads is not set', () => {
      // When maxLeads is 0 or undefined, it falls back to default (20)
      const staff = createMockStaff({ activeLeads: 5, maxLeads: undefined });
      const utilization = calculateLeadUtilization(staff.workload);
      assert.strictEqual(utilization, 0.25); // 5/20 = 0.25
    });

    it('should handle full capacity', () => {
      const staff = createMockStaff({ activeLeads: 20, maxLeads: 20 });
      const utilization = calculateLeadUtilization(staff.workload);
      assert.strictEqual(utilization, 1);
    });
  });

  describe('calculateCustomerUtilization', () => {
    it('should calculate correct utilization', () => {
      const staff = createMockStaff({ activeCustomers: 30, maxCustomers: 60 });
      const utilization = calculateCustomerUtilization(staff.workload);
      assert.strictEqual(utilization, 0.5);
    });
  });

  describe('calculateOverallUtilization', () => {
    it('should average lead and customer utilization', () => {
      const staff = createMockStaff({
        activeLeads: 10,
        maxLeads: 20,
        activeCustomers: 30,
        maxCustomers: 60,
      });
      const utilization = calculateOverallUtilization(staff.workload);
      assert.strictEqual(utilization, 0.5);
    });
  });

  describe('getWorkloadStatus', () => {
    it('should return available for low utilization', () => {
      assert.strictEqual(getWorkloadStatus(0.5), 'available');
    });

    it('should return warning at 80%', () => {
      assert.strictEqual(getWorkloadStatus(0.8), 'warning');
    });

    it('should return warning at 90%', () => {
      assert.strictEqual(getWorkloadStatus(0.9), 'warning');
    });

    it('should return at_capacity at 100%', () => {
      assert.strictEqual(getWorkloadStatus(1.0), 'at_capacity');
    });

    it('should return over_capacity above 100%', () => {
      assert.strictEqual(getWorkloadStatus(1.1), 'over_capacity');
    });
  });

  describe('canAcceptNewLead', () => {
    it('should allow when under capacity', () => {
      const staff = createMockStaff({ activeLeads: 10, maxLeads: 20 });
      const result = canAcceptNewLead(staff);
      assert.strictEqual(result.canAccept, true);
      assert.strictEqual(result.status, 'available');
    });

    it('should block when at capacity', () => {
      const staff = createMockStaff({ activeLeads: 20, maxLeads: 20 });
      const result = canAcceptNewLead(staff);
      assert.strictEqual(result.canAccept, false);
      assert.strictEqual(result.status, 'at_capacity');
      assert.ok(result.reason?.includes('capacity'));
    });

    it('should warn when near capacity', () => {
      const staff = createMockStaff({ activeLeads: 18, maxLeads: 20 });
      const result = canAcceptNewLead(staff);
      assert.strictEqual(result.canAccept, true);
      assert.strictEqual(result.status, 'warning');
    });
  });

  describe('canAcceptNewCustomer', () => {
    it('should allow when under capacity', () => {
      const staff = createMockStaff({ activeCustomers: 30, maxCustomers: 60 });
      const result = canAcceptNewCustomer(staff);
      assert.strictEqual(result.canAccept, true);
    });

    it('should block when at capacity', () => {
      const staff = createMockStaff({ activeCustomers: 60, maxCustomers: 60 });
      const result = canAcceptNewCustomer(staff);
      assert.strictEqual(result.canAccept, false);
    });
  });

  describe('getWorkloadBreakdown', () => {
    it('should return correct breakdown', () => {
      const staff = createMockStaff({
        activeLeads: 10,
        maxLeads: 20,
        activeCustomers: 30,
        maxCustomers: 60,
        activePolicies: 25,
        pendingApprovals: 3,
      });
      const breakdown = getWorkloadBreakdown(staff);
      
      assert.strictEqual(breakdown.leads.current, 10);
      assert.strictEqual(breakdown.leads.max, 20);
      assert.strictEqual(breakdown.leads.available, 10);
      assert.strictEqual(breakdown.customers.current, 30);
      assert.strictEqual(breakdown.customers.available, 30);
      assert.strictEqual(breakdown.policies.current, 25);
      assert.strictEqual(breakdown.pendingApprovals, 3);
    });
  });

  describe('getWorkloadInfo', () => {
    it('should return complete workload info', () => {
      const staff = createMockStaff();
      const info = getWorkloadInfo(staff);
      
      assert.ok(info.workload);
      assert.ok(typeof info.workload.utilizationRate === 'number');
      assert.ok(info.breakdown);
      assert.ok(info.availability);
      assert.strictEqual(info.availability.isAvailable, true);
    });
  });

  describe('incrementWorkload', () => {
    it('should increment activeLeads', () => {
      const workload = {
        activeLeads: 5,
        activeCustomers: 10,
        activePolicies: 8,
        pendingApprovals: 2,
      };
      const result = incrementWorkload(workload, 'activeLeads');
      assert.strictEqual(result.activeLeads, 6);
      assert.strictEqual(result.activeCustomers, 10);
    });

    it('should increment activeCustomers', () => {
      const workload = {
        activeLeads: 5,
        activeCustomers: 10,
        activePolicies: 8,
        pendingApprovals: 2,
      };
      const result = incrementWorkload(workload, 'activeCustomers');
      assert.strictEqual(result.activeCustomers, 11);
    });
  });

  describe('decrementWorkload', () => {
    it('should decrement activeLeads', () => {
      const workload = {
        activeLeads: 5,
        activeCustomers: 10,
        activePolicies: 8,
        pendingApprovals: 2,
      };
      const result = decrementWorkload(workload, 'activeLeads');
      assert.strictEqual(result.activeLeads, 4);
    });

    it('should not go below zero', () => {
      const workload = {
        activeLeads: 0,
        activeCustomers: 10,
        activePolicies: 8,
        pendingApprovals: 2,
      };
      const result = decrementWorkload(workload, 'activeLeads');
      assert.strictEqual(result.activeLeads, 0);
    });
  });
});

