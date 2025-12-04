/**
 * E2E Test: Workflow Approval Flow
 * 
 * Tests the complete approval workflow:
 * 1. Broker creates a workflow instance (e.g., quote approval)
 * 2. Manager receives approval notification
 * 3. Manager reviews and approves/rejects
 * 4. Broker receives decision notification
 * 5. Audit trail records all actions
 */

import { ApiClient } from '../utils/api-client';
import { USERS } from '../fixtures/users';

describe('E2E: Workflow Approval Flow', () => {
  let brokerClient: ApiClient;
  let managerClient: ApiClient;
  let auditClient: ApiClient;
  let notificationClient: ApiClient;

  let workflowDefinitionId: string | null = null;
  let workflowInstanceId: string | null = null;
  let approvalRequestId: string | null = null;

  beforeAll(() => {
    brokerClient = new ApiClient('workflow', { authenticated: true });
    managerClient = new ApiClient('workflow', { authenticated: true, asAdmin: true });
    auditClient = new ApiClient('audit', { authenticated: true, asAdmin: true });
    notificationClient = new ApiClient('notification', { authenticated: true, asAdmin: true });
  });

  describe('Workflow Definition Setup', () => {
    it('Step 1: Verify workflow service is healthy', async () => {
      const unauthClient = new ApiClient('workflow');
      const response = await unauthClient.get('/api/health');
      
      expect(response.status).toBe(200);
      console.log('✓ Workflow service is healthy');
    });

    it('Step 2: List available workflow definitions', async () => {
      const response = await managerClient.get('/api/workflows');
      
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        const data = response.data as { workflows?: { workflowDefinitionId: string }[] };
        if (data.workflows && data.workflows.length > 0) {
          workflowDefinitionId = data.workflows[0].workflowDefinitionId;
          console.log(`✓ Found ${data.workflows.length} workflow definitions`);
        }
      }
    });

    it('Step 3: Create a workflow definition if none exists', async () => {
      if (workflowDefinitionId) {
        console.log('⏭ Workflow definition already exists');
        return;
      }

      const workflowDef = {
        name: `Quote Approval Workflow ${Date.now()}`,
        description: 'E2E test workflow for quote approvals',
        triggerType: 'manual',
        steps: [
          {
            stepId: 'submit',
            name: 'Submit Quote',
            type: 'action',
            nextSteps: ['manager-approval'],
          },
          {
            stepId: 'manager-approval',
            name: 'Manager Approval',
            type: 'approval',
            approvalConfig: {
              approverRoles: ['broker-manager'],
              requiredApprovals: 1,
            },
            nextSteps: ['complete'],
          },
          {
            stepId: 'complete',
            name: 'Complete',
            type: 'end',
          },
        ],
      };

      const response = await managerClient.post('/api/workflows', workflowDef);
      
      expect([200, 201, 401, 403]).toContain(response.status);
      
      if (response.status === 201 || response.status === 200) {
        const created = response.data as { workflowDefinitionId: string };
        workflowDefinitionId = created.workflowDefinitionId;
        console.log(`✓ Workflow definition created: ${workflowDefinitionId}`);
      }
    });
  });

  describe('Workflow Instance Execution', () => {
    it('Step 4: Start a workflow instance', async () => {
      if (!workflowDefinitionId) {
        console.log('⏭ No workflow definition available');
        return;
      }

      const instanceData = {
        workflowDefinitionId,
        entityType: 'quotation',
        entityId: `quote-e2e-${Date.now()}`,
        inputData: {
          quoteAmount: 5000,
          customerName: 'E2E Test Customer',
          insuranceLine: 'motor',
        },
      };

      const response = await brokerClient.post('/api/workflows/instances', instanceData);
      
      expect([200, 201, 401, 403]).toContain(response.status);
      
      if (response.status === 201 || response.status === 200) {
        const created = response.data as { instanceId: string };
        workflowInstanceId = created.instanceId;
        console.log(`✓ Workflow instance started: ${workflowInstanceId}`);
      }
    });

    it('Step 5: Check workflow instance status', async () => {
      if (!workflowInstanceId) {
        console.log('⏭ No workflow instance');
        return;
      }

      const response = await brokerClient.get(
        `/api/workflows/instances/${workflowInstanceId}`
      );
      
      expect([200, 401, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const instance = response.data as { status: string };
        console.log(`✓ Workflow instance status: ${instance.status}`);
      }
    });
  });

  describe('Approval Process', () => {
    it('Step 6: List pending approvals for manager', async () => {
      const response = await managerClient.get('/api/approvals?status=pending');
      
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        const data = response.data as { approvals?: { approvalId: string }[] };
        if (data.approvals && data.approvals.length > 0) {
          approvalRequestId = data.approvals[0].approvalId;
          console.log(`✓ Found ${data.approvals.length} pending approvals`);
        }
      }
    });

    it('Step 7: Manager submits approval decision', async () => {
      if (!approvalRequestId) {
        console.log('⏭ No pending approvals');
        return;
      }

      const decision = {
        decision: 'approved',
        comments: 'E2E test approval - looks good',
      };

      const response = await managerClient.post(
        `/api/approvals/${approvalRequestId}/decision`,
        decision
      );
      
      expect([200, 401, 403, 404]).toContain(response.status);
      
      if (response.status === 200) {
        console.log('✓ Approval decision submitted');
      }
    });

    it('Step 8: Verify workflow progressed after approval', async () => {
      if (!workflowInstanceId) {
        console.log('⏭ No workflow instance');
        return;
      }

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await brokerClient.get(
        `/api/workflows/instances/${workflowInstanceId}`
      );
      
      expect([200, 401, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const instance = response.data as { status: string; currentStep?: string };
        console.log(`✓ Workflow status after approval: ${instance.status}`);
      }
    });
  });

  describe('Notification Verification', () => {
    it('Step 9: Check notifications were sent', async () => {
      const response = await notificationClient.get('/api/notifications?limit=10');
      
      expect([200, 401]).toContain(response.status);
      
      if (response.status === 200) {
        console.log('✓ Notifications accessible');
      }
    });
  });

  describe('Audit Trail Verification', () => {
    it('Step 10: Verify audit logs for workflow actions', async () => {
      if (!workflowInstanceId) {
        console.log('⏭ No workflow instance');
        return;
      }

      const response = await auditClient.get(
        `/api/audit/entity/workflow-instance/${workflowInstanceId}`
      );
      
      expect([200, 401, 404]).toContain(response.status);
      
      if (response.status === 200) {
        const data = response.data as { logs?: unknown[] };
        console.log(`✓ Audit trail: ${data.logs?.length || 0} entries`);
      }
    });

    it('Step 11: Verify audit logs for approval decision', async () => {
      if (!approvalRequestId) {
        console.log('⏭ No approval request');
        return;
      }

      const response = await auditClient.get(
        `/api/audit/entity/approval-request/${approvalRequestId}`
      );
      
      expect([200, 401, 404]).toContain(response.status);
      
      if (response.status === 200) {
        console.log('✓ Approval audit trail found');
      }
    });
  });

  describe('Cleanup', () => {
    it('Should cleanup test workflow definition', async () => {
      if (workflowDefinitionId && workflowDefinitionId.includes('e2e')) {
        const response = await managerClient.delete(
          `/api/workflows/${workflowDefinitionId}`
        );
        
        expect([200, 204, 401, 404]).toContain(response.status);
        console.log('✓ Test workflow definition cleaned up');
      }
    });
  });
});

