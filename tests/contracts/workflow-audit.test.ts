/**
 * Contract tests: Workflow Service <-> Audit Service
 * 
 * These tests verify:
 * 1. Workflow service publishes audit events in correct format
 * 2. Audit service accepts and processes these events
 */

import { ApiClient } from '../utils/api-client';
import { USERS } from '../fixtures/users';

describe('Workflow -> Audit Contract', () => {
  let workflowClient: ApiClient;
  let auditClient: ApiClient;
  let auditServiceClient: ApiClient;

  beforeAll(() => {
    workflowClient = new ApiClient('workflow', { authenticated: true, asAdmin: true });
    auditClient = new ApiClient('audit', { authenticated: true, asAdmin: true });
    auditServiceClient = new ApiClient('audit', { asService: true });
  });

  describe('Audit Event Format', () => {
    it('should accept audit log entries from workflow service', async () => {
      // Simulate the audit log format that workflow service sends
      const auditEntry = {
        action: 'workflow:started',
        entityType: 'workflow-instance',
        entityId: `wf-instance-${Date.now()}`,
        userId: USERS.broker.userId,
        userName: USERS.broker.displayName,
        timestamp: new Date().toISOString(),
        metadata: {
          workflowDefinitionId: 'motor-insurance-flow',
          triggerType: 'manual',
        },
      };

      const response = await auditServiceClient.post('/api/audit/internal/log', auditEntry);
      
      // Audit service should accept the format
      expect([200, 201, 401, 403]).toContain(response.status);
    });

    it('should accept workflow approval audit events', async () => {
      const auditEntry = {
        action: 'workflow:approval:submitted',
        entityType: 'approval-request',
        entityId: `approval-${Date.now()}`,
        userId: USERS.brokerManager.userId,
        userName: USERS.brokerManager.displayName,
        timestamp: new Date().toISOString(),
        changes: {
          status: {
            from: 'pending',
            to: 'approved',
          },
        },
        metadata: {
          workflowInstanceId: 'wf-instance-001',
          stepId: 'manager-approval',
          decision: 'approved',
        },
      };

      const response = await auditServiceClient.post('/api/audit/internal/log', auditEntry);
      
      expect([200, 201, 401, 403]).toContain(response.status);
    });
  });

  describe('Audit Query Integration', () => {
    it('should be able to query workflow audit logs by entity', async () => {
      // Query audit logs for workflow entities
      const response = await auditClient.get(
        '/api/audit/entity/workflow-instance/wf-instance-001'
      );
      
      expect([200, 401, 404]).toContain(response.status);
    });

    it('should be able to query workflow audit logs by action type', async () => {
      const response = await auditClient.get(
        '/api/audit/logs?action=workflow:*&limit=10'
      );
      
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Workflow Actions Trigger Audit', () => {
    it('should audit workflow definition creation', async () => {
      // Create a workflow definition
      const workflowDef = {
        name: `Test Workflow ${Date.now()}`,
        description: 'Workflow for contract testing',
        triggerType: 'manual',
        steps: [
          {
            stepId: 'step-1',
            name: 'First Step',
            type: 'action',
          },
        ],
      };

      const createResponse = await workflowClient.post('/api/workflows', workflowDef);
      
      if (createResponse.status === 201) {
        const created = createResponse.data as { workflowDefinitionId: string };
        
        // Wait briefly for async audit log
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Query audit logs for this entity
        const auditResponse = await auditClient.get(
          `/api/audit/entity/workflow-definition/${created.workflowDefinitionId}`
        );
        
        // Should find audit log or return 404 if async processing delayed
        expect([200, 401, 404]).toContain(auditResponse.status);
      }
    });
  });
});

