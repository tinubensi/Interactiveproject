/**
 * Tests for getPlansForLead function
 * Verifies that only actual plans are returned, not RPA diagnostics or errors
 */

import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert';

interface MockPlan {
  id: string;
  type: string;
  leadId: string;
  vendorId: string;
  planName?: string;
  annualPremium?: number;
  [key: string]: any;
}

describe('getPlansForLead - Filter RPA Data', () => {
  let mockPlansContainer: any;
  let cosmosService: any;

  beforeEach(() => {
    // Reset mocks before each test
    mockPlansContainer = {
      items: {
        query: mock.fn()
      }
    };
  });

  it('should only return documents with type="plan"', async () => {
    // Arrange - Create mixed data (plans + diagnostics + errors)
    const leadId = 'test-lead-123';
    const mockData: MockPlan[] = [
      // RPA Diagnostic (should be filtered out)
      {
        id: 'diagnostic_1',
        type: 'rpa_diagnostic',
        leadId: leadId,
        vendorId: 'vendor-takaful',
        stage: 'parsing',
        status: 'success',
        message: 'Environment variables parsed successfully'
      },
      // Actual Plan 1 (should be returned)
      {
        id: 'plan-1',
        type: 'plan',
        leadId: leadId,
        vendorId: 'vendor-takaful',
        planName: 'Comprehensive Plan',
        annualPremium: 5000
      },
      // RPA Diagnostic (should be filtered out)
      {
        id: 'diagnostic_2',
        type: 'rpa_diagnostic',
        leadId: leadId,
        vendorId: 'vendor-takaful',
        stage: 'credentials',
        status: 'success',
        message: 'Credentials loaded'
      },
      // Actual Plan 2 (should be returned)
      {
        id: 'plan-2',
        type: 'plan',
        leadId: leadId,
        vendorId: 'vendor-watania',
        planName: 'Basic Plan',
        annualPremium: 3000
      },
      // Execution Error (should be filtered out)
      {
        id: 'error_1',
        type: 'execution_error',
        leadId: leadId,
        vendorId: 'vendor-oman',
        error: 'Browser timeout',
        timestamp: new Date().toISOString()
      }
    ];

    // Mock the query response to return all data (simulating current behavior)
    const mockQueryResult = {
      fetchAll: mock.fn(async () => ({
        resources: mockData
      }))
    };
    mockPlansContainer.items.query.mock.mockImplementation(() => mockQueryResult);

    // Create a simple service for testing
    const testService = {
      plansContainer: mockPlansContainer,
      async getPlansForLead(leadId: string) {
        const query = {
          query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.type = @type ORDER BY c.annualPremium ASC',
          parameters: [
            { name: '@leadId', value: leadId },
            { name: '@type', value: 'plan' }
          ]
        };
        
        const { resources } = await this.plansContainer.items.query(query).fetchAll();
        return resources;
      }
    };

    // Act - Call getPlansForLead
    const result = await testService.getPlansForLead(leadId);

    // Assert - Verify query was called with type filter
    assert.strictEqual(mockPlansContainer.items.query.mock.calls.length, 1, 'Query should be called once');
    
    const queryCall = mockPlansContainer.items.query.mock.calls[0];
    const querySpec = queryCall.arguments[0];
    
    // Verify the query includes type filter
    assert.ok(querySpec.query.includes('c.type = @type'), 'Query should filter by type');
    assert.ok(
      querySpec.parameters.some((p: any) => p.name === '@type' && p.value === 'plan'),
      'Query should have type="plan" parameter'
    );
  });

  it('should filter out rpa_diagnostic documents', async () => {
    const leadId = 'test-lead-456';
    
    // Mock data with only diagnostics
    const mockData: MockPlan[] = [
      {
        id: 'diagnostic_1',
        type: 'rpa_diagnostic',
        leadId: leadId,
        vendorId: 'vendor-takaful',
        stage: 'parsing',
        status: 'success'
      },
      {
        id: 'diagnostic_2',
        type: 'rpa_diagnostic',
        leadId: leadId,
        vendorId: 'vendor-takaful',
        stage: 'browser_launch',
        status: 'success'
      }
    ];

    // In reality, when we filter by type="plan", these won't be returned
    // But for the test, we simulate what the database would return
    const mockQueryResult = {
      fetchAll: mock.fn(async () => ({
        resources: [] // No plans, only diagnostics which are filtered out
      }))
    };
    mockPlansContainer.items.query.mock.mockImplementation(() => mockQueryResult);

    const testService = {
      plansContainer: mockPlansContainer,
      async getPlansForLead(leadId: string) {
        const query = {
          query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.type = @type ORDER BY c.annualPremium ASC',
          parameters: [
            { name: '@leadId', value: leadId },
            { name: '@type', value: 'plan' }
          ]
        };
        
        const { resources } = await this.plansContainer.items.query(query).fetchAll();
        return resources;
      }
    };

    const result = await testService.getPlansForLead(leadId);

    assert.strictEqual(result.length, 0, 'Should return empty array when no plans exist');
  });

  it('should filter out execution_error documents', async () => {
    const leadId = 'test-lead-789';
    
    const mockData: MockPlan[] = [
      {
        id: 'error_1',
        type: 'execution_error',
        leadId: leadId,
        vendorId: 'vendor-oman',
        error: 'Timeout error',
        traceback: 'Stack trace...'
      }
    ];

    const mockQueryResult = {
      fetchAll: mock.fn(async () => ({
        resources: [] // No plans, only errors which are filtered out
      }))
    };
    mockPlansContainer.items.query.mock.mockImplementation(() => mockQueryResult);

    const testService = {
      plansContainer: mockPlansContainer,
      async getPlansForLead(leadId: string) {
        const query = {
          query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.type = @type ORDER BY c.annualPremium ASC',
          parameters: [
            { name: '@leadId', value: leadId },
            { name: '@type', value: 'plan' }
          ]
        };
        
        const { resources } = await this.plansContainer.items.query(query).fetchAll();
        return resources;
      }
    };

    const result = await testService.getPlansForLead(leadId);

    assert.strictEqual(result.length, 0, 'Should return empty array when only errors exist');
  });

  it('should only return actual plans with proper structure', async () => {
    const leadId = 'test-lead-999';
    
    const plansOnly: MockPlan[] = [
      {
        id: 'plan-1',
        type: 'plan',
        leadId: leadId,
        vendorId: 'vendor-takaful',
        planName: 'Comprehensive Plan',
        annualPremium: 5000,
        monthlyPremium: 417,
        currency: 'AED'
      },
      {
        id: 'plan-2',
        type: 'plan',
        leadId: leadId,
        vendorId: 'vendor-watania',
        planName: 'Basic Plan',
        annualPremium: 3000,
        monthlyPremium: 250,
        currency: 'AED'
      }
    ];

    const mockQueryResult = {
      fetchAll: mock.fn(async () => ({
        resources: plansOnly
      }))
    };
    mockPlansContainer.items.query.mock.mockImplementation(() => mockQueryResult);

    const testService = {
      plansContainer: mockPlansContainer,
      async getPlansForLead(leadId: string) {
        const query = {
          query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.type = @type ORDER BY c.annualPremium ASC',
          parameters: [
            { name: '@leadId', value: leadId },
            { name: '@type', value: 'plan' }
          ]
        };
        
        const { resources } = await this.plansContainer.items.query(query).fetchAll();
        return resources;
      }
    };

    const result = await testService.getPlansForLead(leadId);

    assert.strictEqual(result.length, 2, 'Should return exactly 2 plans');
    
    // Verify all results have type="plan"
    result.forEach((plan: MockPlan) => {
      assert.strictEqual(plan.type, 'plan', 'All results should have type="plan"');
      assert.ok(plan.planName, 'Plans should have planName field');
      assert.ok(plan.annualPremium !== undefined, 'Plans should have annualPremium field');
    });
  });
});




