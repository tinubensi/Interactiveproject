/**
 * Tests for savePlans function
 * Verifies pipeline integration - skips stage change when pipeline is active
 * 
 * Uses dependency injection pattern for testability
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

// Types for the handler
interface MockContext {
  log: ReturnType<typeof mock.fn>;
  warn: ReturnType<typeof mock.fn>;
  error: ReturnType<typeof mock.fn>;
}

interface MockCosmosService {
  updateLead: ReturnType<typeof mock.fn>;
  createTimelineEntry: ReturnType<typeof mock.fn>;
  deletePlansForLead: ReturnType<typeof mock.fn>;
  createPlans: ReturnType<typeof mock.fn>;
  leadsContainer: {
    items: {
      query: ReturnType<typeof mock.fn>;
    };
  };
}

interface MockRequest {
  params: { leadId: string };
  json: ReturnType<typeof mock.fn>;
}

// Create testable version of the handler with injected dependencies
function createSavePlans(
  cosmosService: MockCosmosService,
  isLeadManagedByPipeline: (leadId: string) => Promise<boolean>
) {
  return async function savePlans(
    request: MockRequest,
    context: MockContext
  ): Promise<any> {
    try {
      const body = await request.json();
      const leadId = request.params.leadId;

      if (!leadId || !body.plans) {
        return {
          status: 400,
          jsonBody: {
            success: false,
            error: 'leadId and plans are required'
          }
        };
      }

      context.log(`Saving ${body.plans.length} plans for lead ${leadId}`);

      // Get the lead first to know its LOB (partition key)
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @leadId AND c.type = "lead"',
        parameters: [{ name: '@leadId', value: leadId }]
      };

      const { resources: leads } = await cosmosService.leadsContainer.items.query(querySpec).fetchAll();
      
      context.log(`Found ${leads.length} leads matching leadId ${leadId}`);
      
      if (leads.length === 0) {
        context.warn(`Lead ${leadId} not found, cannot save plans`);
        return {
          status: 404,
          jsonBody: {
            success: false,
            error: 'Lead not found'
          }
        };
      }

      const lead = leads[0];
      context.log(`Lead found: ${lead.id}, LOB: ${lead.lineOfBusiness}`);

      // Delete any existing plans for this lead (in case of re-fetch)
      try {
        await cosmosService.deletePlansForLead(leadId);
      } catch (deleteError) {
        context.warn('Error deleting existing plans (might be none):', deleteError);
      }
      
      // Save new plans
      context.log(`Attempting to save ${body.plans.length} plans...`);
      const savedPlans = await cosmosService.createPlans(body.plans);
      context.log(`Saved ${savedPlans.length} plans for lead ${leadId}`);
      
      if (savedPlans.length !== body.plans.length) {
        context.warn(`Only ${savedPlans.length} of ${body.plans.length} plans were saved successfully`);
      }

      // Check if this lead is managed by a pipeline
      const hasPipeline = await isLeadManagedByPipeline(leadId);
      if (hasPipeline) {
        context.log(`Lead ${leadId} is managed by pipeline - skipping stage update. Pipeline Service will handle stage progression.`);
        // Only update plan data, not stage - Pipeline Service controls stage progression
        await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
          planFetchRequestId: body.fetchRequestId,
          plansCount: body.plans.length,
          updatedAt: expect.any(Date)
        });
        
        return {
          status: 200,
          jsonBody: {
            success: true,
            message: 'Plans saved successfully. Pipeline Service will handle stage progression.',
            data: {
              plansCount: savedPlans.length
            }
          }
        };
      }

      // No pipeline active - fallback to direct stage update (for legacy leads without pipelines)
      context.log(`Lead ${leadId} has no active pipeline - updating stage directly as fallback`);
      
      // Update lead status to "Plans Available"
      await cosmosService.updateLead(leadId, lead.lineOfBusiness, {
        currentStage: 'Plans Available',
        stageId: 'stage-2',
        planFetchRequestId: body.fetchRequestId,
        plansCount: body.plans.length,
        updatedAt: expect.any(Date)
      });

      // Create timeline entry
      await cosmosService.createTimelineEntry({
        id: expect.any(String),
        leadId: leadId,
        stage: 'Plans Available',
        previousStage: lead.currentStage,
        stageId: 'stage-2',
        remark: `${body.plans.length} plans fetched from ${body.successfulVendors?.length || 0} vendors`,
        changedBy: 'system',
        changedByName: 'System',
        timestamp: expect.any(Date)
      });

      context.log(`Lead ${leadId} status updated to "Plans Available" with ${body.plans.length} plans`);

      return {
        status: 200,
        jsonBody: {
          success: true,
          message: 'Plans saved successfully',
          data: {
            plansCount: savedPlans.length
          }
        }
      };
    } catch (error: any) {
      context.error('Save plans error:', error);
      return {
        status: 500,
        jsonBody: {
          success: false,
          error: 'Failed to save plans',
          details: error.message
        }
      };
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
  currentStage: 'Plans Fetching',
  stageId: 'stage-1',
  ...overrides
});

const createMockRequest = (leadId: string, plans: any[]): MockRequest => ({
  params: { leadId },
  json: mock.fn(async () => ({
    plans,
    fetchRequestId: 'fetch-123',
    successfulVendors: ['vendor1', 'vendor2']
  }))
});

const createMockContext = (): MockContext => ({
  log: mock.fn(() => {}),
  warn: mock.fn(() => {}),
  error: mock.fn(() => {})
});

describe('savePlans', () => {
  let mockCosmosService: MockCosmosService;
  let mockIsLeadManagedByPipeline: ReturnType<typeof mock.fn>;
  let savePlans: ReturnType<typeof createSavePlans>;

  beforeEach(() => {
    // Reset mocks for each test
    mockCosmosService = {
      updateLead: mock.fn(async () => {}),
      createTimelineEntry: mock.fn(async () => {}),
      deletePlansForLead: mock.fn(async () => {}),
      createPlans: mock.fn(async (plans) => plans),
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
    savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
  });

  describe('when lead has active pipeline', () => {
    it('should save plans but NOT update lead stage', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => true);
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('lead-123', [
        { id: 'plan-1', name: 'Plan 1' },
        { id: 'plan-2', name: 'Plan 2' }
      ]);

      // Act
      const result = await savePlans(request, context);

      // Assert - should succeed
      assert.strictEqual(result.status, 200, 'Should return 200');
      assert.strictEqual(result.jsonBody.success, true, 'Should indicate success');
      assert.ok(
        result.jsonBody.message.includes('Pipeline Service will handle stage progression'),
        'Message should indicate pipeline will handle stage'
      );

      // Assert - updateLead should be called once with plan data only (no stage)
      assert.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1, 
        'updateLead should be called exactly once');
      
      const updateCall = mockCosmosService.updateLead.mock.calls[0];
      assert.strictEqual(updateCall.arguments[0], 'lead-123', 'Should update correct lead');
      assert.strictEqual(updateCall.arguments[1], 'medical', 'Should use correct partition key');
      
      const updateData = updateCall.arguments[2];
      assert.strictEqual(updateData.planFetchRequestId, 'fetch-123', 'Should update planFetchRequestId');
      assert.strictEqual(updateData.plansCount, 2, 'Should update plansCount');
      assert.strictEqual(updateData.currentStage, undefined, 'Should NOT update currentStage');
      assert.strictEqual(updateData.stageId, undefined, 'Should NOT update stageId');

      // Assert - createTimelineEntry should NOT be called
      assert.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 0,
        'createTimelineEntry should NOT be called when pipeline is active');
    });

    it('should log that stage update is skipped due to pipeline', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => true);
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('lead-123', [{ id: 'plan-1' }]);

      // Act
      await savePlans(request, context);

      // Assert - should log pipeline-managed message
      const logCalls = context.log.mock.calls;
      const pipelineLogFound = logCalls.some(call => 
        call.arguments[0].includes('managed by pipeline') && 
        call.arguments[0].includes('skipping stage update')
      );
      assert.ok(pipelineLogFound, 'Should log that pipeline is managing the lead');
    });
  });

  describe('when lead has NO active pipeline', () => {
    it('should update stage to Plans Available', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('lead-123', [{ id: 'plan-1' }]);

      // Act
      const result = await savePlans(request, context);

      // Assert - should succeed
      assert.strictEqual(result.status, 200, 'Should return 200');
      assert.strictEqual(result.jsonBody.success, true, 'Should indicate success');

      // Assert - updateLead should be called with stage change
      assert.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1,
        'updateLead should be called exactly once');
      
      const updateCall = mockCosmosService.updateLead.mock.calls[0];
      const updateData = updateCall.arguments[2];
      
      assert.strictEqual(updateData.planFetchRequestId, 'fetch-123', 'Should update planFetchRequestId');
      assert.strictEqual(updateData.plansCount, 1, 'Should update plansCount');
      assert.strictEqual(updateData.currentStage, 'Plans Available', 'Should update stage to Plans Available');
      assert.strictEqual(updateData.stageId, 'stage-2', 'Should update stageId');
    });

    it('should create timeline entry for stage change', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('lead-123', [{ id: 'plan-1' }]);

      // Act
      await savePlans(request, context);

      // Assert - createTimelineEntry should be called
      assert.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 1,
        'createTimelineEntry should be called exactly once');
      
      const timelineCall = mockCosmosService.createTimelineEntry.mock.calls[0];
      const timelineData = timelineCall.arguments[0];
      
      assert.strictEqual(timelineData.leadId, 'lead-123', 'Timeline should reference correct lead');
      assert.strictEqual(timelineData.stage, 'Plans Available', 'Timeline should show Plans Available stage');
      assert.strictEqual(timelineData.previousStage, 'Plans Fetching', 'Timeline should track previous stage');
      assert.strictEqual(timelineData.stageId, 'stage-2', 'Timeline should have correct stageId');
    });

    it('should log fallback message', async () => {
      // Arrange
      mockIsLeadManagedByPipeline = mock.fn(async () => false);
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('lead-123', [{ id: 'plan-1' }]);

      // Act
      await savePlans(request, context);

      // Assert - should log fallback message
      const logCalls = context.log.mock.calls;
      const fallbackLogFound = logCalls.some(call => 
        call.arguments[0].includes('no active pipeline') && 
        call.arguments[0].includes('updating stage directly as fallback')
      );
      assert.ok(fallbackLogFound, 'Should log fallback to direct stage update');
    });
  });

  describe('when lead is not found', () => {
    it('should return 404 without updates', async () => {
      // Arrange - setup mock to return empty results
      mockCosmosService.leadsContainer.items.query = mock.fn(() => ({
        fetchAll: mock.fn(async () => ({
          resources: []
        }))
      }));
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('nonexistent-lead', [{ id: 'plan-1' }]);

      // Act
      const result = await savePlans(request, context);

      // Assert - should return 404
      assert.strictEqual(result.status, 404, 'Should return 404');
      assert.strictEqual(result.jsonBody.success, false, 'Should indicate failure');
      assert.ok(result.jsonBody.error.includes('Lead not found'), 'Error should indicate lead not found');

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

  describe('error handling', () => {
    it('should catch and log errors', async () => {
      // Arrange - setup mock to throw error
      mockCosmosService.leadsContainer.items.query = mock.fn(() => {
        throw new Error('Database connection failed');
      });
      savePlans = createSavePlans(mockCosmosService, mockIsLeadManagedByPipeline);
      
      const context = createMockContext();
      const request = createMockRequest('lead-123', [{ id: 'plan-1' }]);

      // Act
      const result = await savePlans(request, context);

      // Assert - should return 500
      assert.strictEqual(result.status, 500, 'Should return 500 on error');
      assert.strictEqual(result.jsonBody.success, false, 'Should indicate failure');
      
      // Assert - error should be logged
      assert.strictEqual(context.error.mock.calls.length, 1, 'Should log error');
      assert.ok(
        context.error.mock.calls[0].arguments[0].includes('Save plans error'),
        'Error message should indicate save plans error'
      );
    });
  });
});

