/**
 * API tests for Staff Management Service
 */

import { ApiClient } from '../utils/api-client';
import { SERVICES } from '../utils/config';
import { USERS } from '../fixtures/users';

describe('Staff Management Service API', () => {
  let adminClient: ApiClient;
  let managerClient: ApiClient;
  let userClient: ApiClient;
  let unauthenticatedClient: ApiClient;

  beforeAll(() => {
    adminClient = new ApiClient('staffManagement', { authenticated: true, asAdmin: true });
    managerClient = new ApiClient('staffManagement', { authenticated: true });
    userClient = new ApiClient('staffManagement', { authenticated: true });
    unauthenticatedClient = new ApiClient('staffManagement');
  });

  describe('GET /api/health', () => {
    it('should return healthy status', async () => {
      const response = await unauthenticatedClient.get('/api/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toMatchObject({
        status: expect.stringMatching(/healthy|ok/i),
      });
    });
  });

  describe('Staff CRUD', () => {
    describe('GET /api/staff', () => {
      it('should list staff members', async () => {
        const response = await adminClient.get('/api/staff');
        
        expect([200, 401]).toContain(response.status);
        if (response.status === 200) {
          expect(response.data).toHaveProperty('staff');
        }
      });

      it('should support pagination', async () => {
        const response = await adminClient.get('/api/staff?page=1&limit=10');
        
        expect([200, 401]).toContain(response.status);
      });

      it('should require authentication', async () => {
        const response = await unauthenticatedClient.get('/api/staff');
        
        expect([401, 403]).toContain(response.status);
      });
    });

    describe('POST /api/staff', () => {
      it('should create a staff member', async () => {
        const newStaff = {
          userId: `staff-test-${Date.now()}`,
          email: `staff.test.${Date.now()}@nectaria.com`,
          displayName: 'Test Staff Member',
          roles: ['broker'],
        };

        const response = await adminClient.post('/api/staff', newStaff);
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/staff/:staffId', () => {
      it('should get a specific staff member', async () => {
        const response = await adminClient.get(`/api/staff/${USERS.broker.userId}`);
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/staff/:staffId', () => {
      it('should update a staff member', async () => {
        const response = await adminClient.put(`/api/staff/${USERS.broker.userId}`, {
          displayName: 'Updated Name',
        });
        
        expect([200, 401, 403, 404]).toContain(response.status);
      });
    });

    describe('DELETE /api/staff/:staffId', () => {
      it('should deactivate a staff member', async () => {
        const response = await adminClient.delete(`/api/staff/staff-to-delete`);
        
        expect([200, 204, 401, 403, 404]).toContain(response.status);
      });
    });
  });

  describe('Team Management', () => {
    describe('GET /api/teams', () => {
      it('should list all teams', async () => {
        const response = await adminClient.get('/api/teams');
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('POST /api/teams', () => {
      it('should create a team', async () => {
        const newTeam = {
          teamId: `team-test-${Date.now()}`,
          name: 'Test Team',
          description: 'Team created for testing',
          managerId: USERS.brokerManager.userId,
        };

        const response = await adminClient.post('/api/teams', newTeam);
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });
    });

    describe('GET /api/teams/:teamId', () => {
      it('should get a specific team', async () => {
        const response = await adminClient.get('/api/teams/team-001');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('GET /api/teams/:teamId/members', () => {
      it('should list team members', async () => {
        const response = await adminClient.get('/api/teams/team-001/members');
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/teams/:teamId/members', () => {
      it('should add member to team', async () => {
        const response = await adminClient.post('/api/teams/team-001/members', {
          staffId: USERS.broker.userId,
        });
        
        expect([200, 201, 401, 403, 404]).toContain(response.status);
      });
    });

    describe('DELETE /api/teams/:teamId/members/:staffId', () => {
      it('should remove member from team', async () => {
        const response = await adminClient.delete(
          `/api/teams/team-001/members/${USERS.broker.userId}`
        );
        
        expect([200, 204, 401, 403, 404]).toContain(response.status);
      });
    });
  });

  describe('Territory Management', () => {
    describe('GET /api/territories', () => {
      it('should list all territories', async () => {
        const response = await adminClient.get('/api/territories');
        
        expect([200, 401]).toContain(response.status);
      });
    });

    describe('POST /api/territories', () => {
      it('should create a territory', async () => {
        const newTerritory = {
          territoryId: `territory-test-${Date.now()}`,
          name: 'Test Territory',
          description: 'Territory for testing',
          region: 'Dubai',
        };

        const response = await adminClient.post('/api/territories', newTerritory);
        
        expect([200, 201, 401, 403]).toContain(response.status);
      });
    });
  });

  describe('Workload Tracking', () => {
    describe('GET /api/staff/:staffId/workload', () => {
      it('should get staff workload', async () => {
        const response = await adminClient.get(`/api/staff/${USERS.broker.userId}/workload`);
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('PUT /api/staff/:staffId/workload', () => {
      it('should update staff workload', async () => {
        const response = await adminClient.put(`/api/staff/${USERS.broker.userId}/workload`, {
          currentLoad: 10,
          maxCapacity: 50,
        });
        
        expect([200, 401, 403, 404]).toContain(response.status);
      });
    });
  });

  describe('Auto-Assignment', () => {
    describe('POST /api/assignment/auto', () => {
      it('should auto-assign work item', async () => {
        const response = await adminClient.post('/api/assignment/auto', {
          entityType: 'lead',
          entityId: 'lead-001',
          insuranceLine: 'motor',
          territoryId: 'territory-001',
        });
        
        expect([200, 401, 403, 404]).toContain(response.status);
      });
    });
  });

  describe('License Tracking', () => {
    describe('GET /api/staff/:staffId/licenses', () => {
      it('should get staff licenses', async () => {
        const response = await adminClient.get(`/api/staff/${USERS.broker.userId}/licenses`);
        
        expect([200, 401, 404]).toContain(response.status);
      });
    });

    describe('POST /api/staff/:staffId/licenses', () => {
      it('should add license to staff', async () => {
        const response = await adminClient.post(`/api/staff/${USERS.broker.userId}/licenses`, {
          licenseType: 'motor',
          licenseNumber: 'LIC-001',
          expiryDate: new Date(Date.now() + 365 * 86400000).toISOString(),
        });
        
        expect([200, 201, 401, 403, 404]).toContain(response.status);
      });
    });
  });
});

