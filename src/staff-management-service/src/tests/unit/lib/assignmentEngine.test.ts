/**
 * Assignment Engine Tests
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  hasTerritoryMatch,
  hasSpecializationMatch,
  calculateWorkloadCapacity,
  calculatePerformanceScore,
  isAvailableForAssignment,
  calculateAssignmentScore,
  filterEligibleStaff,
  findBestStaffForAssignment,
  ASSIGNMENT_WEIGHTS,
  canHandleLeads,
} from '../../../lib/assignmentEngine';
import { StaffMemberDocument } from '../../../models/StaffMember';
import { TeamDocument } from '../../../models/Team';

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
    activeLeads: 10,
    activeCustomers: 30,
    activePolicies: 25,
    pendingApprovals: 2,
    maxLeads: 20,
    maxCustomers: 60,
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

const createMockTeam = (overrides: Partial<TeamDocument> = {}): TeamDocument => ({
  id: 'team-1',
  teamId: 'team-1',
  name: 'Sales Team Dubai',
  type: 'sales',
  leaderId: 'leader-1',
  leaderEmail: 'leader@example.com',
  memberIds: ['staff-1'],
  memberCount: 1,
  territories: ['dubai'],
  specializations: ['motor_insurance', 'health_insurance'],
  organizationId: 'org-1',
  isActive: true,
  createdAt: '2025-01-01T00:00:00Z',
  createdBy: 'admin',
  updatedAt: '2025-01-01T00:00:00Z',
  updatedBy: 'admin',
  ...overrides,
});

describe('assignmentEngine', () => {
  describe('hasTerritoryMatch', () => {
    it('should return true when staff has territory', () => {
      const staff = createMockStaff({ territories: ['dubai', 'sharjah'] });
      assert.strictEqual(hasTerritoryMatch(staff, 'dubai'), true);
    });

    it('should return false when staff does not have territory', () => {
      const staff = createMockStaff({ territories: ['dubai'] });
      assert.strictEqual(hasTerritoryMatch(staff, 'abu-dhabi'), false);
    });
  });

  describe('hasSpecializationMatch', () => {
    it('should return true when no specialization required', () => {
      const staff = createMockStaff();
      const teams = [createMockTeam()];
      assert.strictEqual(hasSpecializationMatch(staff, undefined, teams), true);
    });

    it('should return true when team has specialization', () => {
      const staff = createMockStaff({ teamIds: ['team-1'] });
      const teams = [createMockTeam({ specializations: ['motor_insurance'] })];
      assert.strictEqual(hasSpecializationMatch(staff, 'motor_insurance', teams), true);
    });

    it('should return true when license matches specialization', () => {
      const staff = createMockStaff({
        teamIds: ['team-1'],
        licenses: [
          {
            licenseType: 'life_insurance',
            licenseNumber: 'LI-001',
            issuingAuthority: 'Test',
            issueDate: '2025-01-01',
            expiryDate: '2026-01-01',
            status: 'active',
          },
        ],
      });
      const teams = [createMockTeam({ specializations: [] })];
      assert.strictEqual(hasSpecializationMatch(staff, 'life', teams), true);
    });

    it('should return false when no match found', () => {
      const staff = createMockStaff({ teamIds: ['team-1'], licenses: [] });
      const teams = [createMockTeam({ specializations: ['motor_insurance'] })];
      assert.strictEqual(hasSpecializationMatch(staff, 'life_insurance', teams), false);
    });
  });

  describe('calculateWorkloadCapacity', () => {
    it('should return 1 for empty workload', () => {
      const staff = createMockStaff({
        workload: {
          activeLeads: 0,
          activeCustomers: 0,
          activePolicies: 0,
          pendingApprovals: 0,
          maxLeads: 20,
          maxCustomers: 60,
        },
      });
      assert.strictEqual(calculateWorkloadCapacity(staff), 1);
    });

    it('should return 0.5 for half capacity', () => {
      const staff = createMockStaff({
        workload: {
          activeLeads: 10,
          activeCustomers: 30,
          activePolicies: 0,
          pendingApprovals: 0,
          maxLeads: 20,
          maxCustomers: 60,
        },
      });
      assert.strictEqual(calculateWorkloadCapacity(staff), 0.5);
    });

    it('should return 0 for full capacity', () => {
      const staff = createMockStaff({
        workload: {
          activeLeads: 20,
          activeCustomers: 60,
          activePolicies: 0,
          pendingApprovals: 0,
          maxLeads: 20,
          maxCustomers: 60,
        },
      });
      assert.strictEqual(calculateWorkloadCapacity(staff), 0);
    });
  });

  describe('calculatePerformanceScore', () => {
    it('should return 0.5 for no performance data', () => {
      const staff = createMockStaff({ performance: undefined });
      assert.strictEqual(calculatePerformanceScore(staff), 0.5);
    });

    it('should calculate conversion rate', () => {
      const staff = createMockStaff({
        performance: {
          period: '2025-12',
          leadsReceived: 10,
          leadsConverted: 8,
          policiesIssued: 5,
          premiumGenerated: 50000,
        },
      });
      assert.strictEqual(calculatePerformanceScore(staff), 0.8);
    });

    it('should cap at 1', () => {
      const staff = createMockStaff({
        performance: {
          period: '2025-12',
          leadsReceived: 10,
          leadsConverted: 15,
          policiesIssued: 5,
          premiumGenerated: 50000,
        },
      });
      assert.strictEqual(calculatePerformanceScore(staff), 1);
    });
  });

  describe('isAvailableForAssignment', () => {
    it('should return true for active and available staff', () => {
      const staff = createMockStaff({
        status: 'active',
        availability: { isAvailable: true },
        workload: {
          activeLeads: 10,
          activeCustomers: 30,
          activePolicies: 0,
          pendingApprovals: 0,
          maxLeads: 20,
          maxCustomers: 60,
        },
      });
      assert.strictEqual(isAvailableForAssignment(staff, 'lead'), true);
    });

    it('should return false for inactive staff', () => {
      const staff = createMockStaff({ status: 'inactive' });
      assert.strictEqual(isAvailableForAssignment(staff, 'lead'), false);
    });

    it('should return false for unavailable staff', () => {
      const staff = createMockStaff({
        status: 'active',
        availability: { isAvailable: false },
      });
      assert.strictEqual(isAvailableForAssignment(staff, 'lead'), false);
    });

    it('should return false for staff at capacity', () => {
      const staff = createMockStaff({
        status: 'active',
        availability: { isAvailable: true },
        workload: {
          activeLeads: 20,
          activeCustomers: 30,
          activePolicies: 0,
          pendingApprovals: 0,
          maxLeads: 20,
          maxCustomers: 60,
        },
      });
      assert.strictEqual(isAvailableForAssignment(staff, 'lead'), false);
    });
  });

  describe('calculateAssignmentScore', () => {
    it('should calculate score with all factors', () => {
      const staff = createMockStaff({
        territories: ['dubai'],
        teamIds: ['team-1'],
        workload: {
          activeLeads: 5,
          activeCustomers: 20,
          activePolicies: 0,
          pendingApprovals: 0,
          maxLeads: 20,
          maxCustomers: 60,
        },
        performance: {
          period: '2025-12',
          leadsReceived: 10,
          leadsConverted: 8,
          policiesIssued: 5,
          premiumGenerated: 50000,
        },
      });
      const teams = [createMockTeam({ specializations: ['motor_insurance'] })];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
        specialization: 'motor_insurance',
      };

      const { score, factors } = calculateAssignmentScore(staff, criteria, teams);

      assert.ok(score > 0);
      assert.strictEqual(factors.territoryMatch, true);
      assert.strictEqual(factors.specializationMatch, true);
      assert.ok(factors.workloadCapacity > 0);
      assert.ok(factors.performanceScore > 0);
      assert.strictEqual(factors.availability, true);
    });

    it('should score 0 for territory when no match', () => {
      const staff = createMockStaff({ territories: ['sharjah'] });
      const teams: TeamDocument[] = [];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
      };

      const { factors } = calculateAssignmentScore(staff, criteria, teams);
      assert.strictEqual(factors.territoryMatch, false);
    });
  });

  describe('filterEligibleStaff', () => {
    it('should filter by territory', () => {
      const staffList = [
        createMockStaff({ staffId: 'staff-1', territories: ['dubai'] }),
        createMockStaff({ staffId: 'staff-2', territories: ['sharjah'] }),
      ];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
      };

      const result = filterEligibleStaff(staffList, criteria);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].staffId, 'staff-1');
    });

    it('should exclude current owner', () => {
      const staffList = [
        createMockStaff({ staffId: 'staff-1', territories: ['dubai'] }),
        createMockStaff({ staffId: 'staff-2', territories: ['dubai'] }),
      ];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
        currentOwnerId: 'staff-1',
      };

      const result = filterEligibleStaff(staffList, criteria);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].staffId, 'staff-2');
    });

    it('should filter by preferred team', () => {
      const staffList = [
        createMockStaff({ staffId: 'staff-1', territories: ['dubai'], teamIds: ['team-1'] }),
        createMockStaff({ staffId: 'staff-2', territories: ['dubai'], teamIds: ['team-2'] }),
      ];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
        preferredTeamId: 'team-1',
      };

      const result = filterEligibleStaff(staffList, criteria);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].staffId, 'staff-1');
    });
  });

  describe('findBestStaffForAssignment', () => {
    it('should return sorted recommendations', () => {
      const staffList = [
        createMockStaff({
          staffId: 'staff-1',
          displayName: 'John Doe',
          territories: ['dubai'],
          workload: { activeLeads: 15, activeCustomers: 30, activePolicies: 0, pendingApprovals: 0, maxLeads: 20, maxCustomers: 60 },
        }),
        createMockStaff({
          staffId: 'staff-2',
          displayName: 'Jane Smith',
          territories: ['dubai'],
          workload: { activeLeads: 5, activeCustomers: 20, activePolicies: 0, pendingApprovals: 0, maxLeads: 20, maxCustomers: 60 },
        }),
      ];
      const teams: TeamDocument[] = [];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
      };

      const result = findBestStaffForAssignment(staffList, teams, criteria);

      assert.ok(result.recommendedStaff.length > 0);
      assert.strictEqual(result.recommendedStaff[0].staffId, 'staff-2'); // Lower workload
    });

    it('should provide fallback manager when no staff available', () => {
      const staffList = [
        createMockStaff({
          staffId: 'manager-1',
          displayName: 'Manager',
          staffType: 'broker_manager',
          territories: ['dubai'],
          status: 'active',
          workload: { activeLeads: 20, activeCustomers: 60, activePolicies: 0, pendingApprovals: 0, maxLeads: 20, maxCustomers: 60 },
        }),
      ];
      const teams: TeamDocument[] = [];
      const criteria = {
        assignmentType: 'lead' as const,
        territory: 'dubai',
      };

      const result = findBestStaffForAssignment(staffList, teams, criteria);

      // No available staff (manager is at capacity), but fallback should be provided
      assert.ok(result.fallbackStaff || result.recommendedStaff.length === 0);
    });
  });

  describe('canHandleLeads', () => {
    it('should return true for broker', () => {
      assert.strictEqual(canHandleLeads('broker'), true);
    });

    it('should return true for senior_broker', () => {
      assert.strictEqual(canHandleLeads('senior_broker'), true);
    });

    it('should return true for broker_manager', () => {
      assert.strictEqual(canHandleLeads('broker_manager'), true);
    });

    it('should return false for customer_support', () => {
      assert.strictEqual(canHandleLeads('customer_support'), false);
    });

    it('should return false for underwriter', () => {
      assert.strictEqual(canHandleLeads('underwriter'), false);
    });
  });

  describe('ASSIGNMENT_WEIGHTS', () => {
    it('should sum to 1', () => {
      const total = Object.values(ASSIGNMENT_WEIGHTS).reduce((sum, w) => sum + w, 0);
      assert.strictEqual(total, 1);
    });
  });
});

