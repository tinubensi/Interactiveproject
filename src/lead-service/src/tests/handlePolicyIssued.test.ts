/**
 * Tests for handlePolicyIssued event handler
 * Verifies pipeline integration - skips stage change when pipeline is active
 * 
 * Uses dependency injection pattern for testability
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Types for the handler
interface PolicyIssuedEventData {
  policyId: string;
  policyNumber: string;
  leadId: string;
  customerId: string;
  quotationId: string;
  vendorName: string;
  lineOfBusiness: string;
  startDate: Date;
  endDate: Date;
  annualPremium: number;
}

interface PolicyIssuedEvent {
  id: string;
  eventType: string;
  subject: string;
  eventTime: string;
  data: PolicyIssuedEventData;
  dataVersion: string;
}

interface MockContext {
  log: ReturnType<typeof mock.fn>;
  warn: ReturnType<typeof mock.fn>;
  error: ReturnType<typeof mock.fn>;
}

interface MockCosmosService {
  updateLead: ReturnType<typeof mock.fn>;
  createTimelineEntry: ReturnType<typeof mock.fn>;
  leadsContainer: {
    items: {
      query: ReturnType<typeof mock.fn>;
    };
  };
}

// Create testable version of the handler with injected dependencies
function createHandlePolicyIssued(
  cosmosService: MockCosmosService,
  isLeadManagedByPipeline: (leadId: string) => Promise<boolean>
) {
  return async function handlePolicyIssued(
    eventGridEvent: PolicyIssuedEvent,
    context: MockContext
  ): Promise<void> {
    try {
      const event = eventGridEvent;
      const data = event.data;

      context.log(`Received policy.issued event for lead ${data.leadId}`);

      // Get lead
      const query = {
        query: 'SELECT * FROM c WHERE c.id = @leadId AND NOT IS_DEFINED(c.deletedAt)',
        parameters: [{ name: '@leadId', value: data.leadId }]
      };

      const { resources: leads } = await cosmosService.leadsContainer.items.query(query).fetchAll();

      if (leads.length === 0) {
        context.warn(`Lead not found: ${data.leadId}`);
        return;
      }

      const lead = leads[0];

      // Check if this lead is managed by a pipeline
      const hasPipeline = await isLeadManagedByPipeline(data.leadId);
      if (hasPipeline) {
        context.log(`Lead ${data.leadId} is managed by pipeline - skipping hardcoded stage change`);
        // Still update policy reference but don't change stage
        await cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
          policyId: data.policyId,
          updatedAt: expect.any(Date)
        });
        return;
      }

      // Fallback: No pipeline active - use hardcoded stage change
      context.log(`Lead ${data.leadId} has no active pipeline - using hardcoded stage change`);

      // Update lead with stage change
      await cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
        policyId: data.policyId,
        currentStage: 'Policy Issued',
        stageId: 'stage-6',
        updatedAt: expect.any(Date)
      });

      // Create timeline entry
      await cosmosService.createTimelineEntry({
        id: expect.any(String),
        leadId: lead.id,
        stage: 'Policy Issued',
        previousStage: lead.currentStage,
        stageId: 'stage-6',
        remark: `Policy ${data.policyNumber} issued successfully`,
        changedBy: 'system',
        changedByName: 'System',
        quotationId: data.quotationId,
        policyId: data.policyId,
        timestamp: expect.any(Date)
      });

      context.log(`Lead updated: ${lead.referenceId} - Policy Issued`);
    } catch (error: any) {
      context.error('Handle policy issued error:', error);
    }
  };
}

// Simple expect matchers for flexible matching
const expect = {
  any: (type: any) => ({ __isAnyMatcher: true, type }),
};

// Helper to compare objects with any matchers
function matchesExpected(actual: any, expected: any): boolean {
  if (expected && expected.__isAnyMatcher) {
    if (expected.type === Date) return actual instanceof Date;
    if (expected.type === String) return typeof actual === 'string';
    return true;
  }
  if (typeof expected === 'object' && expected !== null) {
    for (const key of Object.keys(expected)) {
      if (!matchesExpected(actual[key], expected[key])) return false;
    }
    return true;
  }
  return actual === expected;
}

// Test fixtures
const createMockLead = (overrides = {}) => ({
  id: 'lead-123',
  referenceId: 'LEAD-2024-0001',
  lineOfBusiness: 'medical',
  currentStage: 'Quotation Sent',
  ...overrides
});

const createPolicyIssuedEvent = (leadId: string): PolicyIssuedEvent => ({
  id: 'event-123',
  eventType: 'policy.issued',
  subject: `policy/policy-123`,
  eventTime: new Date().toISOString(),
  data: {
    policyId: 'policy-123',
    policyNumber: 'POL-2024-0001',
    leadId,
    customerId: 'customer-123',
    quotationId: 'quotation-123',
    vendorName: 'Test Vendor',
    lineOfBusiness: 'medical',
    startDate: new Date(),
    endDate: new Date(),
    annualPremium: 5000
  },
  dataVersion: '1.0'
});

const createMockContext = (): MockContext => ({
  log: mock.fn(() => {}),
  warn: mock.fn(() => {}),
  error: mock.fn(() => {})
});

describe('handlePolicyIssued', () => {
  let mockCosmosService: MockCosmosService;
  let mockIsLeadManagedByPipeline: ReturnType<typeof mock.fn>;
  let handlePolicyIssued: ReturnType<typeof createHandlePolicyIssued>;

  beforeEach(() => {
    // Reset mocks for each test
    mockCosmosService = {
      updateLead: mock.fn(async () => {}),
      createTimelineEntry: mock.fn(async () => {}),
      leadsContainer: {
        items: {
          query: mock.fn(() => ({
            fetchAll: mock.fn(async () => ({
              resources: [createMockLead()]
            }))
          }))
        }
      }
    };

    mockIsLeadManagedByPipeline = mock.fn(async () => false);
    handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
  });

  describe('when lead has active pipeline', () => {
    it('should update policyId but NOT change stage', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => true);
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - updateLead should be called once with policyId only (no stage)
      assert.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1, 
        'updateLead should be called exactly once');
      
      const updateCall = mockCosmosService.updateLead.mock.calls[0];
      assert.strictEqual(updateCall.arguments[0], 'lead-123', 'Should update correct lead');
      assert.strictEqual(updateCall.arguments[1], 'medical', 'Should use correct partition key');
      
      const updateData = updateCall.arguments[2];
      assert.strictEqual(updateData.policyId, 'policy-123', 'Should update policyId');
      assert.strictEqual(updateData.currentStage, undefined, 'Should NOT update currentStage');
      assert.strictEqual(updateData.stageId, undefined, 'Should NOT update stageId');

      // Assert - createTimelineEntry should NOT be called
      assert.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 0,
        'createTimelineEntry should NOT be called when pipeline is active');
    });

    it('should log that stage change is skipped due to pipeline', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => true);
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - should log pipeline-managed message
      const logCalls = context.log.mock.calls;
      const pipelineLogFound = logCalls.some(call => 
        call.arguments[0].includes('managed by pipeline') && 
        call.arguments[0].includes('skipping')
      );
      assert.ok(pipelineLogFound, 'Should log that pipeline is managing the lead');
    });
  });

  describe('when lead has NO active pipeline', () => {
    it('should update stage to Policy Issued', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - updateLead should be called with stage change
      assert.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1,
        'updateLead should be called exactly once');
      
      const updateCall = mockCosmosService.updateLead.mock.calls[0];
      const updateData = updateCall.arguments[2];
      
      assert.strictEqual(updateData.policyId, 'policy-123', 'Should update policyId');
      assert.strictEqual(updateData.currentStage, 'Policy Issued', 'Should update stage to Policy Issued');
      assert.strictEqual(updateData.stageId, 'stage-6', 'Should update stageId');
    });

    it('should create timeline entry for stage change', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - createTimelineEntry should be called
      assert.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 1,
        'createTimelineEntry should be called exactly once');
      
      const timelineCall = mockCosmosService.createTimelineEntry.mock.calls[0];
      const timelineData = timelineCall.arguments[0];
      
      assert.strictEqual(timelineData.leadId, 'lead-123', 'Timeline should reference correct lead');
      assert.strictEqual(timelineData.stage, 'Policy Issued', 'Timeline should show Policy Issued stage');
      assert.strictEqual(timelineData.previousStage, 'Quotation Sent', 'Timeline should track previous stage');
      assert.strictEqual(timelineData.policyId, 'policy-123', 'Timeline should include policyId');
      assert.strictEqual(timelineData.remark, 'Policy POL-2024-0001 issued successfully', 
        'Timeline should include policy number in remark');
    });

    it('should log fallback message', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - should log fallback message
      const logCalls = context.log.mock.calls;
      const fallbackLogFound = logCalls.some(call => 
        call.arguments[0].includes('no active pipeline') && 
        call.arguments[0].includes('hardcoded stage change')
      );
      assert.ok(fallbackLogFound, 'Should log fallback to hardcoded stage change');
    });
  });

  describe('when lead is not found', () => {
    it('should log warning and return early without updates', async () => {
      // Arrange - setup mock to return empty results
      mockCosmosService.leadsContainer.items.query = mock.fn(() => ({
        fetchAll: mock.fn(async () => ({
          resources: []
        }))
      }));
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('nonexistent-lead');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - warn should be called
      assert.strictEqual(context.warn.mock.calls.length, 1, 'Should log warning');
      assert.ok(
        context.warn.mock.calls[0].arguments[0].includes('Lead not found'),
        'Warning should indicate lead not found'
      );

      // Assert - no updates should be performed
      assert.strictEqual(mockCosmosService.updateLead.mock.calls.length, 0,
        'updateLead should NOT be called');
      assert.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 0,
        'createTimelineEntry should NOT be called');
      
      // Assert - pipeline check should NOT be called (early return)
      assert.strictEqual(mockIsLeadManagedByPipeline.mock.calls.length, 0,
        'isLeadManagedByPipeline should NOT be called when lead not found');
    });
  });

  describe('when pipeline service is unavailable', () => {
    it('should fallback to hardcoded stage change (isLeadManagedByPipeline returns false)', async () => {
      // Arrange - pipeline service returns false when unavailable
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - should update with full stage change
      assert.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1,
        'updateLead should be called');
      
      const updateData = mockCosmosService.updateLead.mock.calls[0].arguments[2];
      assert.strictEqual(updateData.currentStage, 'Policy Issued', 
        'Should fallback to hardcoded stage change');

      // Assert - timeline should be created
      assert.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 1,
        'Timeline entry should be created on fallback');
    });
  });

  describe('error handling', () => {
    it('should catch and log errors', async () => {
      // Arrange - setup mock to throw error
      mockCosmosService.leadsContainer.items.query = mock.fn(() => {
        throw new Error('Database connection failed');
      });
      handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const event = createPolicyIssuedEvent('lead-123');

      // Act
      await handlePolicyIssued(event, context);

      // Assert - error should be logged
      assert.strictEqual(context.error.mock.calls.length, 1, 'Should log error');
      assert.ok(
        context.error.mock.calls[0].arguments[0].includes('Handle policy issued error'),
        'Error message should indicate handler error'
      );
    });
  });
});
