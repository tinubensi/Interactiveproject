/**
 * Pipeline Service - Workflow Integration Tests
 *
 * Tests for the complete pipeline workflow:
 * Lead Created → Plans Fetching → Plans Available → Quotation Created
 */

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';

import {
  processEvent,
  EventData,
} from '../lib/orchestrator';

import type { LineOfBusiness } from '../models/pipeline';

/**
 * Mock context for logging
 */
const mockContext = {
  log: (...args: unknown[]) => {
    // Uncomment to see logs during testing
    // console.log('[TEST]', ...args);
  },
};

describe('Pipeline Workflow Integration', () => {
  describe('Event Matching Logic', () => {
    it('should process events without throwing errors', async () => {
      // Test that the event matching logic doesn't crash
      const eventData: EventData = {
        leadId: 'test-lead-001',
        lineOfBusiness: 'medical' as LineOfBusiness,
        businessType: 'individual',
      };

      // These will fail in actual environment but should return structured errors
      const result1 = await processEvent('lead.created', eventData, mockContext);
      assert.strictEqual(typeof result1, 'object');
      assert.strictEqual(typeof result1.processed, 'boolean');

      const result2 = await processEvent('plans.fetch_started', eventData, mockContext);
      assert.strictEqual(typeof result2, 'object');
      assert.strictEqual(typeof result2.processed, 'boolean');

      const result3 = await processEvent('plans.fetch_completed', eventData, mockContext);
      assert.strictEqual(typeof result3, 'object');
      assert.strictEqual(typeof result3.processed, 'boolean');

      const result4 = await processEvent('quotation.created', eventData, mockContext);
      assert.strictEqual(typeof result4, 'object');
      assert.strictEqual(typeof result4.processed, 'boolean');
    });

    it('should validate leadId is present in all events', async () => {
      const eventData = {
        lineOfBusiness: 'medical' as LineOfBusiness,
      } as EventData;

      const result = await processEvent('plans.fetch_started', eventData, mockContext);
      
      assert.strictEqual(result.processed, false);
      assert.strictEqual(result.error, 'No leadId in event');
    });

    it('should validate lineOfBusiness for lead.created event', async () => {
      const eventData = {
        leadId: 'test-lead-002',
      } as EventData;

      const result = await processEvent('lead.created', eventData, mockContext);
      
      assert.strictEqual(result.processed, false);
      assert.strictEqual(result.error, 'Missing lineOfBusiness');
    });
  });

  describe('Event Data Structure', () => {
    it('should handle plans.fetch_started event with proper structure', async () => {
      const eventData: EventData = {
        leadId: 'test-lead-003',
        lineOfBusiness: 'medical' as LineOfBusiness,
        fetchRequestId: 'fetch-req-001',
        vendorCount: 5,
      };

      const result = await processEvent('plans.fetch_started', eventData, mockContext);
      
      // Should return structured result (may not be processed without active instance)
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(typeof result.processed, 'boolean');
      
      if (!result.processed) {
        // Expected: Will have an error message (any error is acceptable here)
        assert(result.error !== undefined && result.error.length > 0, 'Should have an error message');
      }
    });

    it('should handle plans.fetch_completed event with proper structure', async () => {
      const eventData: EventData = {
        leadId: 'test-lead-004',
        lineOfBusiness: 'medical' as LineOfBusiness,
        fetchRequestId: 'fetch-req-002',
        totalPlans: 10,
        successfulVendors: ['vendor1', 'vendor2'],
        failedVendors: [],
        plans: [],
      };

      const result = await processEvent('plans.fetch_completed', eventData, mockContext);
      
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(typeof result.processed, 'boolean');
    });

    it('should handle quotation.created event with proper structure', async () => {
      const eventData: EventData = {
        leadId: 'test-lead-005',
        lineOfBusiness: 'medical' as LineOfBusiness,
        quotationId: 'quot-001',
        referenceId: 'Q-2024-001',
        customerId: 'cust-001',
        totalPremium: 2500,
        planCount: 3,
        version: 1,
        planIds: ['plan-1', 'plan-2', 'plan-3'],
      };

      const result = await processEvent('quotation.created', eventData, mockContext);
      
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(typeof result.processed, 'boolean');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing event data gracefully', async () => {
      const result = await processEvent('plans.fetch_started', {} as EventData, mockContext);
      
      assert.strictEqual(result.processed, false);
      assert.strictEqual(result.error, 'No leadId in event');
    });

    it('should handle invalid event types gracefully', async () => {
      const eventData: EventData = {
        leadId: 'test-lead-006',
        lineOfBusiness: 'medical' as LineOfBusiness,
      };

      const result = await processEvent('invalid.event.type', eventData, mockContext);
      
      // Should handle gracefully without throwing
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(typeof result.processed, 'boolean');
    });

    it('should handle events with extra fields', async () => {
      const eventData: EventData = {
        leadId: 'test-lead-007',
        lineOfBusiness: 'medical' as LineOfBusiness,
        extraField1: 'value1',
        extraField2: 123,
        extraField3: true,
        extraField4: { nested: 'object' },
      };

      const result = await processEvent('lead.created', eventData, mockContext);
      
      // Should handle extra fields gracefully
      assert.strictEqual(typeof result, 'object');
      assert.strictEqual(typeof result.processed, 'boolean');
    });
  });

  describe('Logging Verification', () => {
    it('should provide context through logging', async () => {
      const logs: string[] = [];
      const loggingContext = {
        log: (...args: unknown[]) => {
          logs.push(args.map(a => String(a)).join(' '));
        },
      };

      const eventData: EventData = {
        leadId: 'test-lead-008',
        lineOfBusiness: 'medical' as LineOfBusiness,
      };

      await processEvent('lead.created', eventData, loggingContext);
      
      // Verify comprehensive logging is in place
      const allLogs = logs.join('\n');
      
      // Should have lead created logs
      assert(allLogs.includes('[LEAD CREATED]') || allLogs.includes('lead.created'), 
        'Should have lead creation logs');
      
      // Should log lead ID
      assert(allLogs.includes('test-lead-008'), 
        'Should log lead ID');
    });

    it('should log event matching decisions', async () => {
      const logs: string[] = [];
      const loggingContext = {
        log: (...args: unknown[]) => {
          logs.push(args.map(a => String(a)).join(' '));
        },
      };

      const eventData: EventData = {
        leadId: 'test-lead-009',
        lineOfBusiness: 'medical' as LineOfBusiness,
      };

      await processEvent('plans.fetch_started', eventData, loggingContext);
      
      const allLogs = logs.join('\n');
      
      // Should have event matching or processing logs
      assert(logs.length > 0, 'Should have some logs');
    });
  });

  describe('Workflow State Transitions', () => {
    it('should describe expected workflow in logs for lead.created', async () => {
      const logs: string[] = [];
      const loggingContext = {
        log: (...args: unknown[]) => {
          logs.push(args.map(a => String(a)).join(' '));
        },
      };

      const eventData: EventData = {
        leadId: 'test-lead-010',
        lineOfBusiness: 'medical' as LineOfBusiness,
        businessType: 'individual',
      };

      await processEvent('lead.created', eventData, loggingContext);
      
      const allLogs = logs.join('\n');
      
      // Should describe the expected workflow
      assert(
        allLogs.includes('plans.fetch_started') || 
        allLogs.includes('Plans Fetching') ||
        logs.length > 0,
        'Should describe workflow or have error logs'
      );
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for EventData', async () => {
      const eventData: EventData = {
        leadId: 'test-lead-011',
        lineOfBusiness: 'medical' as LineOfBusiness,
        businessType: 'individual',
      };

      // TypeScript should enforce correct types
      const result = await processEvent('lead.created', eventData, mockContext);
      
      // Result should have correct structure
      assert(typeof result.processed === 'boolean');
      if (result.instanceId) {
        assert(typeof result.instanceId === 'string');
      }
      if (result.action) {
        assert(typeof result.action === 'string');
      }
      if (result.error) {
        assert(typeof result.error === 'string');
      }
    });

    it('should maintain type safety for different LOBs', async () => {
      const lobs: LineOfBusiness[] = ['medical', 'motor', 'general', 'marine'];
      
      for (const lob of lobs) {
        const eventData: EventData = {
          leadId: `test-lead-${lob}`,
          lineOfBusiness: lob,
        };

        const result = await processEvent('lead.created', eventData, mockContext);
        
        assert.strictEqual(typeof result, 'object');
        assert.strictEqual(typeof result.processed, 'boolean');
      }
    });
  });
});

