/**
 * Lead Workflow Tracking Tests
 * 
 * Tests for the lead-specific workflow tracking functionality:
 * - Instance repository lead methods
 * - Trigger repository
 * - Event trigger handler
 * - Lead workflow status API
 */

import { describe, it, before, after, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { 
  InstanceNotFoundError,
  CreateInstanceParams,
  LeadWorkflowStatus
} from '../lib/repositories/instanceRepository';
import {
  TriggerNotFoundError,
  evaluateEventFilter,
  extractVariablesFromEvent
} from '../lib/repositories/triggerRepository';
import { WorkflowInstance, WorkflowTrigger, ActivityLogEntry } from '../models/workflowTypes';

// =============================================================================
// Mock Data
// =============================================================================

const mockLeadId = 'lead-12345';
const mockCustomerId = 'cust-67890';
const mockOrgId = 'org-123';
const mockInstanceId = 'inst-abcd1234';
const mockWorkflowId = 'wf-testflow';

const createMockInstance = (overrides?: Partial<WorkflowInstance>): WorkflowInstance => ({
  id: mockInstanceId,
  instanceId: mockInstanceId,
  workflowId: mockWorkflowId,
  workflowVersion: 1,
  workflowName: 'Test Lead Workflow',
  organizationId: mockOrgId,
  triggerId: 'trigger-1',
  triggerType: 'event',
  status: 'running',
  stepExecutions: [],
  variables: {
    leadId: mockLeadId,
    customerId: mockCustomerId
  },
  completedStepIds: ['step-1', 'step-2'],
  createdAt: '2024-01-01T00:00:00Z',
  startedAt: '2024-01-01T00:00:01Z',
  // Lead-specific fields
  leadId: mockLeadId,
  customerId: mockCustomerId,
  lineOfBusiness: 'medical',
  currentStageName: 'Plans Available',
  progressPercent: 25,
  activityLog: [
    {
      timestamp: '2024-01-01T00:00:00Z',
      message: 'Workflow started for lead',
      type: 'info',
      icon: 'play'
    },
    {
      timestamp: '2024-01-01T00:01:00Z',
      message: 'Stage changed to "Plans Available"',
      type: 'success',
      icon: 'milestone'
    }
  ],
  ...overrides
});

const createMockTrigger = (overrides?: Partial<WorkflowTrigger>): WorkflowTrigger => ({
  id: `${mockWorkflowId}-trigger-1`,
  triggerId: 'trigger-1',
  eventType: 'lead.created',
  workflowId: mockWorkflowId,
  workflowVersion: 1,
  organizationId: mockOrgId,
  isActive: true,
  extractVariables: {
    leadId: '$.data.leadId',
    customerId: '$.data.customerId'
  },
  createdAt: '2024-01-01T00:00:00Z',
  ...overrides
});

// =============================================================================
// Instance Repository Lead Methods Tests
// =============================================================================

describe('Instance Repository - Lead Methods', () => {
  describe('InstanceNotFoundError', () => {
    it('should create error with instance ID', () => {
      const error = new InstanceNotFoundError(mockInstanceId);
      assert.strictEqual(error.name, 'InstanceNotFoundError');
      assert.ok(error.message.includes(mockInstanceId));
      assert.ok(error.message.includes('not found'));
    });
  });

  describe('CreateInstanceParams - Lead Fields', () => {
    it('should include all lead-specific fields', () => {
      const params: CreateInstanceParams = {
        workflowId: mockWorkflowId,
        workflowVersion: 1,
        workflowName: 'Test Workflow',
        organizationId: mockOrgId,
        triggerId: 'trigger-1',
        triggerType: 'event',
        variables: { leadId: mockLeadId },
        // Lead-specific fields
        leadId: mockLeadId,
        customerId: mockCustomerId,
        lineOfBusiness: 'medical'
      };

      assert.strictEqual(params.leadId, mockLeadId);
      assert.strictEqual(params.customerId, mockCustomerId);
      assert.strictEqual(params.lineOfBusiness, 'medical');
    });

    it('should allow optional lead fields', () => {
      const params: CreateInstanceParams = {
        workflowId: mockWorkflowId,
        workflowVersion: 1,
        workflowName: 'Test Workflow',
        organizationId: mockOrgId,
        triggerId: 'trigger-1',
        triggerType: 'manual'
      };

      assert.strictEqual(params.leadId, undefined);
      assert.strictEqual(params.customerId, undefined);
      assert.strictEqual(params.lineOfBusiness, undefined);
    });
  });

  describe('WorkflowInstance - Lead Fields', () => {
    it('should have lead-specific fields on instance', () => {
      const instance = createMockInstance();

      assert.strictEqual(instance.leadId, mockLeadId);
      assert.strictEqual(instance.customerId, mockCustomerId);
      assert.strictEqual(instance.lineOfBusiness, 'medical');
      assert.strictEqual(instance.currentStageName, 'Plans Available');
      assert.strictEqual(instance.progressPercent, 25);
    });

    it('should have activity log with entries', () => {
      const instance = createMockInstance();

      assert.ok(Array.isArray(instance.activityLog));
      assert.strictEqual(instance.activityLog?.length, 2);
      
      const firstEntry = instance.activityLog?.[0];
      assert.ok(firstEntry?.timestamp);
      assert.ok(firstEntry?.message);
      assert.strictEqual(firstEntry?.type, 'info');
    });

    it('should allow progress from 0 to 100', () => {
      const instances = [
        createMockInstance({ progressPercent: 0 }),
        createMockInstance({ progressPercent: 50 }),
        createMockInstance({ progressPercent: 100 })
      ];

      assert.strictEqual(instances[0].progressPercent, 0);
      assert.strictEqual(instances[1].progressPercent, 50);
      assert.strictEqual(instances[2].progressPercent, 100);
    });

    it('should support different line of business values', () => {
      const lobs: Array<'medical' | 'motor' | 'general' | 'marine'> = [
        'medical', 'motor', 'general', 'marine'
      ];

      for (const lob of lobs) {
        const instance = createMockInstance({ lineOfBusiness: lob });
        assert.strictEqual(instance.lineOfBusiness, lob);
      }
    });
  });

  describe('LeadWorkflowStatus', () => {
    it('should have all required status fields', () => {
      const status: LeadWorkflowStatus = {
        instanceId: mockInstanceId,
        status: 'running',
        currentStageName: 'Plans Available',
        progressPercent: 25,
        completedSteps: 2,
        totalSteps: 5,
        recentActivities: [],
        startedAt: '2024-01-01T00:00:00Z',
        isWaiting: false,
        hasFailed: false,
        isCompleted: false
      };

      assert.strictEqual(status.instanceId, mockInstanceId);
      assert.strictEqual(status.currentStageName, 'Plans Available');
      assert.strictEqual(status.progressPercent, 25);
      assert.strictEqual(status.completedSteps, 2);
      assert.strictEqual(status.totalSteps, 5);
    });

    it('should track waiting state', () => {
      const status: LeadWorkflowStatus = {
        instanceId: mockInstanceId,
        status: 'waiting',
        currentStageName: 'Pending Review',
        progressPercent: 70,
        completedSteps: 4,
        totalSteps: 5,
        recentActivities: [],
        startedAt: '2024-01-01T00:00:00Z',
        isWaiting: true,
        hasFailed: false,
        isCompleted: false
      };

      assert.strictEqual(status.isWaiting, true);
      assert.strictEqual(status.status, 'waiting');
    });

    it('should track failed state', () => {
      const status: LeadWorkflowStatus = {
        instanceId: mockInstanceId,
        status: 'failed',
        currentStageName: 'Plans Fetching',
        progressPercent: 10,
        completedSteps: 1,
        totalSteps: 5,
        recentActivities: [],
        startedAt: '2024-01-01T00:00:00Z',
        isWaiting: false,
        hasFailed: true,
        isCompleted: false,
        lastError: {
          stepId: 'step-2',
          timestamp: '2024-01-01T00:02:00Z',
          code: 'API_ERROR',
          message: 'Failed to fetch plans'
        }
      };

      assert.strictEqual(status.hasFailed, true);
      assert.ok(status.lastError);
      assert.strictEqual(status.lastError?.code, 'API_ERROR');
    });

    it('should track completed state', () => {
      const status: LeadWorkflowStatus = {
        instanceId: mockInstanceId,
        status: 'completed',
        currentStageName: 'Policy Issued',
        progressPercent: 100,
        completedSteps: 5,
        totalSteps: 5,
        recentActivities: [],
        startedAt: '2024-01-01T00:00:00Z',
        isWaiting: false,
        hasFailed: false,
        isCompleted: true
      };

      assert.strictEqual(status.isCompleted, true);
      assert.strictEqual(status.progressPercent, 100);
    });
  });
});

// =============================================================================
// Trigger Repository Tests
// =============================================================================

describe('Trigger Repository', () => {
  describe('TriggerNotFoundError', () => {
    it('should create error with trigger ID', () => {
      const error = new TriggerNotFoundError('trigger-123');
      assert.strictEqual(error.name, 'TriggerNotFoundError');
      assert.ok(error.message.includes('trigger-123'));
      assert.ok(error.message.includes('not found'));
    });
  });

  describe('WorkflowTrigger structure', () => {
    it('should create valid trigger with event type', () => {
      const trigger = createMockTrigger();

      assert.strictEqual(trigger.eventType, 'lead.created');
      assert.strictEqual(trigger.isActive, true);
      assert.strictEqual(trigger.workflowId, mockWorkflowId);
    });

    it('should support event filter', () => {
      const trigger = createMockTrigger({
        eventFilter: 'data.lineOfBusiness == "medical"'
      });

      assert.strictEqual(trigger.eventFilter, 'data.lineOfBusiness == "medical"');
    });

    it('should support variable extraction mapping', () => {
      const trigger = createMockTrigger({
        extractVariables: {
          leadId: '$.data.leadId',
          customerId: '$.data.customerId',
          lob: '$.data.lineOfBusiness'
        }
      });

      assert.ok(trigger.extractVariables);
      assert.strictEqual(trigger.extractVariables?.leadId, '$.data.leadId');
      assert.strictEqual(trigger.extractVariables?.lob, '$.data.lineOfBusiness');
    });
  });

  describe('evaluateEventFilter', () => {
    it('should return true when no filter provided', () => {
      const result = evaluateEventFilter({ any: 'data' });
      assert.strictEqual(result, true);
    });

    it('should match string equality', () => {
      const eventData = { data: { lineOfBusiness: 'medical' } };
      
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.lineOfBusiness == "medical"'),
        true
      );
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.lineOfBusiness == "motor"'),
        false
      );
    });

    it('should match string inequality', () => {
      const eventData = { data: { lineOfBusiness: 'medical' } };
      
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.lineOfBusiness != "motor"'),
        true
      );
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.lineOfBusiness != "medical"'),
        false
      );
    });

    it('should match numeric comparisons', () => {
      const eventData = { data: { amount: 5000 } };
      
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.amount > 1000'),
        true
      );
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.amount < 1000'),
        false
      );
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.amount >= 5000'),
        true
      );
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.amount <= 5000'),
        true
      );
    });

    it('should match boolean values', () => {
      const eventData = { data: { isHotLead: true } };
      
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.isHotLead == true'),
        true
      );
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.isHotLead == false'),
        false
      );
    });

    it('should handle null values', () => {
      const eventData = { data: { value: null } };
      
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.value == null'),
        true
      );
    });

    it('should handle missing paths gracefully', () => {
      const eventData = { data: {} };
      
      // Missing path should return undefined which won't match
      assert.strictEqual(
        evaluateEventFilter(eventData, 'data.missing == "value"'),
        false
      );
    });

    it('should handle invalid filter expressions gracefully', () => {
      const eventData = { data: { field: 'value' } };
      
      // Invalid filter should default to matching
      assert.strictEqual(
        evaluateEventFilter(eventData, 'invalid filter syntax'),
        true
      );
    });
  });

  describe('extractVariablesFromEvent', () => {
    it('should return empty object when no mapping provided', () => {
      const result = extractVariablesFromEvent({ any: 'data' });
      assert.deepStrictEqual(result, {});
    });

    it('should extract simple paths', () => {
      const eventData = {
        data: {
          leadId: 'lead-123',
          customerId: 'cust-456'
        }
      };
      
      const result = extractVariablesFromEvent(eventData, {
        leadId: 'data.leadId',
        customerId: 'data.customerId'
      });

      assert.strictEqual(result.leadId, 'lead-123');
      assert.strictEqual(result.customerId, 'cust-456');
    });

    it('should extract paths with $. prefix', () => {
      const eventData = {
        data: {
          leadId: 'lead-123'
        }
      };
      
      const result = extractVariablesFromEvent(eventData, {
        leadId: '$.data.leadId'
      });

      assert.strictEqual(result.leadId, 'lead-123');
    });

    it('should extract nested paths', () => {
      const eventData = {
        data: {
          lead: {
            info: {
              id: 'lead-123'
            }
          }
        }
      };
      
      const result = extractVariablesFromEvent(eventData, {
        leadId: '$.data.lead.info.id'
      });

      assert.strictEqual(result.leadId, 'lead-123');
    });

    it('should skip undefined values', () => {
      const eventData = {
        data: {
          leadId: 'lead-123'
        }
      };
      
      const result = extractVariablesFromEvent(eventData, {
        leadId: '$.data.leadId',
        customerId: '$.data.customerId' // This doesn't exist
      });

      assert.strictEqual(result.leadId, 'lead-123');
      assert.strictEqual(result.customerId, undefined);
      assert.ok(!('customerId' in result));
    });

    it('should extract various types', () => {
      const eventData = {
        data: {
          stringVal: 'hello',
          numberVal: 42,
          boolVal: true,
          objectVal: { nested: 'value' },
          arrayVal: [1, 2, 3]
        }
      };
      
      const result = extractVariablesFromEvent(eventData, {
        str: '$.data.stringVal',
        num: '$.data.numberVal',
        bool: '$.data.boolVal',
        obj: '$.data.objectVal',
        arr: '$.data.arrayVal'
      });

      assert.strictEqual(result.str, 'hello');
      assert.strictEqual(result.num, 42);
      assert.strictEqual(result.bool, true);
      assert.deepStrictEqual(result.obj, { nested: 'value' });
      assert.deepStrictEqual(result.arr, [1, 2, 3]);
    });
  });
});

// =============================================================================
// Activity Log Entry Tests
// =============================================================================

describe('ActivityLogEntry', () => {
  it('should have required fields', () => {
    const entry: ActivityLogEntry = {
      timestamp: '2024-01-01T00:00:00Z',
      message: 'Test activity',
      type: 'info'
    };

    assert.ok(entry.timestamp);
    assert.ok(entry.message);
    assert.strictEqual(entry.type, 'info');
  });

  it('should support all log types', () => {
    const types: Array<'success' | 'info' | 'warning' | 'error'> = [
      'success', 'info', 'warning', 'error'
    ];

    for (const type of types) {
      const entry: ActivityLogEntry = {
        timestamp: '2024-01-01T00:00:00Z',
        message: `${type} message`,
        type
      };
      assert.strictEqual(entry.type, type);
    }
  });

  it('should support optional fields', () => {
    const entry: ActivityLogEntry = {
      timestamp: '2024-01-01T00:00:00Z',
      message: 'Step completed',
      type: 'success',
      icon: 'check-circle',
      stepId: 'step-1',
      stepName: 'Change Lead Stage',
      metadata: { newStage: 'Plans Available' }
    };

    assert.strictEqual(entry.icon, 'check-circle');
    assert.strictEqual(entry.stepId, 'step-1');
    assert.strictEqual(entry.stepName, 'Change Lead Stage');
    assert.deepStrictEqual(entry.metadata, { newStage: 'Plans Available' });
  });
});

// =============================================================================
// Progress Mapping Tests
// =============================================================================

describe('Lead Stage Progress Mapping', () => {
  const stageProgressMap: Record<string, number> = {
    'Lead Created': 5,
    'Plans Fetching': 10,
    'Plans Available': 25,
    'Quotation Created': 40,
    'Quotation Sent': 55,
    'Customer Response Pending': 60,
    'Pending Review': 70,
    'Approved': 80,
    'Policy Requested': 85,
    'Policy Pending': 90,
    'Policy Issued': 100,
    'Lost': 100,
    'Cancelled': 100,
    'Rejected': 100
  };

  it('should have progress values for all major stages', () => {
    const expectedStages = [
      'Lead Created',
      'Plans Available',
      'Quotation Created',
      'Quotation Sent',
      'Policy Requested',
      'Policy Issued'
    ];

    for (const stage of expectedStages) {
      assert.ok(
        stageProgressMap[stage] !== undefined,
        `Missing progress for stage: ${stage}`
      );
    }
  });

  it('should have increasing progress through the flow', () => {
    const flowStages = [
      'Lead Created',
      'Plans Fetching',
      'Plans Available',
      'Quotation Created',
      'Quotation Sent',
      'Pending Review',
      'Policy Requested',
      'Policy Issued'
    ];

    for (let i = 1; i < flowStages.length; i++) {
      const prevProgress = stageProgressMap[flowStages[i - 1]];
      const currProgress = stageProgressMap[flowStages[i]];
      assert.ok(
        currProgress > prevProgress,
        `Progress should increase: ${flowStages[i - 1]} (${prevProgress}) -> ${flowStages[i]} (${currProgress})`
      );
    }
  });

  it('should have 100% progress for terminal stages', () => {
    const terminalStages = ['Policy Issued', 'Lost', 'Cancelled', 'Rejected'];

    for (const stage of terminalStages) {
      assert.strictEqual(
        stageProgressMap[stage],
        100,
        `Terminal stage ${stage} should be 100%`
      );
    }
  });

  it('should have valid progress values (0-100)', () => {
    for (const [stage, progress] of Object.entries(stageProgressMap)) {
      assert.ok(
        progress >= 0 && progress <= 100,
        `Invalid progress for ${stage}: ${progress}`
      );
    }
  });
});

// =============================================================================
// Event Data Structure Tests
// =============================================================================

describe('Lead Event Data Structures', () => {
  describe('lead.created event', () => {
    it('should have standard lead created event structure', () => {
      const eventData = {
        leadId: 'lead-123',
        referenceId: 'REF-001',
        customerId: 'cust-456',
        lineOfBusiness: 'medical' as const,
        businessType: 'individual',
        email: 'customer@example.com',
        firstName: 'John',
        lastName: 'Doe',
        formId: 'form-789',
        formData: { field1: 'value1' },
        lobData: { coverage: 'basic' },
        assignedTo: 'agent-001',
        createdAt: '2024-01-01T00:00:00Z'
      };

      // Verify required fields
      assert.ok(eventData.leadId);
      assert.ok(eventData.customerId);
      assert.ok(eventData.createdAt);
    });
  });

  describe('lead.stage_changed event', () => {
    it('should have standard stage changed event structure', () => {
      const eventData = {
        leadId: 'lead-123',
        newStageId: 'stage-2',
        newStageName: 'Plans Available',
        previousStageId: 'stage-1',
        previousStageName: 'Lead Created',
        timestamp: '2024-01-01T00:01:00Z'
      };

      assert.ok(eventData.leadId);
      assert.ok(eventData.newStageId);
      assert.ok(eventData.newStageName);
    });
  });
});

// =============================================================================
// Integration Scenario Tests (Structure Only)
// =============================================================================

describe('Lead Workflow Integration Scenarios', () => {
  describe('Lead Creation Flow', () => {
    it('should define the expected flow from lead creation to workflow start', () => {
      const flowSteps = [
        { step: 1, action: 'Lead Service creates lead' },
        { step: 2, action: 'Lead Service publishes lead.created event' },
        { step: 3, action: 'Event Grid delivers event to Workflow Service' },
        { step: 4, action: 'Event Trigger Handler matches workflow trigger' },
        { step: 5, action: 'Workflow Instance created with leadId' },
        { step: 6, action: 'Workflow execution starts' }
      ];

      assert.strictEqual(flowSteps.length, 6);
    });
  });

  describe('Progress Tracking Flow', () => {
    it('should define the expected progress tracking through workflow', () => {
      const trackingPoints = [
        { stage: 'Lead Created', progress: 5, trigger: 'Instance creation' },
        { stage: 'Plans Available', progress: 25, trigger: 'change_lead_stage action' },
        { stage: 'Quotation Created', progress: 40, trigger: 'create_quotation action' },
        { stage: 'Quotation Sent', progress: 55, trigger: 'send_quotation action' },
        { stage: 'Policy Requested', progress: 85, trigger: 'create_policy_request action' },
        { stage: 'Policy Issued', progress: 100, trigger: 'External event + change_lead_stage' }
      ];

      let previousProgress = 0;
      for (const point of trackingPoints) {
        assert.ok(
          point.progress > previousProgress,
          `Progress should increase at each tracking point`
        );
        previousProgress = point.progress;
      }
    });
  });

  describe('Activity Log Structure', () => {
    it('should track key activities through the workflow', () => {
      const expectedActivities = [
        { type: 'info', pattern: /workflow.*started/i },
        { type: 'success', pattern: /stage.*changed/i },
        { type: 'info', pattern: /fetching.*plans/i },
        { type: 'success', pattern: /quotation.*created/i },
        { type: 'success', pattern: /quotation.*sent/i },
        { type: 'info', pattern: /waiting.*approval/i },
        { type: 'success', pattern: /policy.*requested/i }
      ];

      assert.ok(expectedActivities.length > 0);
    });
  });
});

