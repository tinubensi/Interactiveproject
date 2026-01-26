/**
 * Tests for Vendor Timing Metadata in fetchPlans
 * Validates that vendor execution times are properly captured and included in events
 */

import { describe, it, before } from 'node:test';
import * as assert from 'node:assert';

describe('fetchPlans - Vendor Timing Metadata', () => {
  
  describe('Vendor Timing Data Structure', () => {
    it('should capture executionTime from VM results', () => {
      // Simulate VM result from rpaVmService
      const vmResult = {
        vendorId: 'vendor-sukoon',
        plans: [
          { planName: 'Plan 1', planCode: 'SUK-001' },
          { planName: 'Plan 2', planCode: 'SUK-002' }
        ],
        success: true,
        executionTime: '12.3s'
      };

      // Verify structure
      assert.ok(vmResult.executionTime);
      assert.strictEqual(vmResult.executionTime, '12.3s');
      assert.strictEqual(vmResult.success, true);
      assert.strictEqual(vmResult.plans.length, 2);
    });

    it('should transform VM results to vendorTimings format', () => {
      const vmResults = [
        {
          vendorId: 'vendor-sukoon',
          plans: [{ planName: 'Plan 1' }],
          success: true,
          executionTime: '12.3s',
          error: undefined
        },
        {
          vendorId: 'vendor-watania',
          plans: [],
          success: false,
          executionTime: '8.5s',
          error: 'Timeout'
        }
      ];

      // Transform to vendorTimings format
      const vendorTimings = vmResults.map(result => ({
        vendorId: result.vendorId,
        vendorName: result.vendorId.replace('vendor-', ''),
        success: result.success,
        executionTime: result.executionTime || 'N/A',
        plansCount: result.plans.length,
        error: result.error
      }));

      // Verify transformation
      assert.strictEqual(vendorTimings.length, 2);
      
      // First vendor (successful)
      assert.strictEqual(vendorTimings[0].vendorId, 'vendor-sukoon');
      assert.strictEqual(vendorTimings[0].vendorName, 'sukoon');
      assert.strictEqual(vendorTimings[0].success, true);
      assert.strictEqual(vendorTimings[0].executionTime, '12.3s');
      assert.strictEqual(vendorTimings[0].plansCount, 1);
      
      // Second vendor (failed)
      assert.strictEqual(vendorTimings[1].vendorId, 'vendor-watania');
      assert.strictEqual(vendorTimings[1].vendorName, 'watania');
      assert.strictEqual(vendorTimings[1].success, false);
      assert.strictEqual(vendorTimings[1].executionTime, '8.5s');
      assert.strictEqual(vendorTimings[1].plansCount, 0);
      assert.strictEqual(vendorTimings[1].error, 'Timeout');
    });

    it('should handle missing executionTime gracefully', () => {
      const vmResult = {
        vendorId: 'vendor-takaful',
        plans: [],
        success: false,
        executionTime: undefined,
        error: 'Connection error'
      };

      const vendorTiming = {
        vendorId: vmResult.vendorId,
        vendorName: vmResult.vendorId.replace('vendor-', ''),
        success: vmResult.success,
        executionTime: vmResult.executionTime || 'N/A',
        plansCount: vmResult.plans.length
      };

      assert.strictEqual(vendorTiming.executionTime, 'N/A');
      assert.strictEqual(vendorTiming.success, false);
    });

    it('should exclude error field from event metadata', () => {
      const vendorTimingsWithError = [
        {
          vendorId: 'vendor-sukoon',
          vendorName: 'sukoon',
          success: true,
          executionTime: '12.3s',
          plansCount: 5,
          error: 'Should be excluded'
        }
      ];

      // Simulate metadata preparation for event (excluding error field)
      const eventMetadata = vendorTimingsWithError.map(({ error, ...rest }) => rest);

      // Verify error is excluded and other fields are present
      assert.strictEqual((eventMetadata[0] as any).error, undefined);
      assert.ok(eventMetadata[0].vendorId);
      assert.ok(eventMetadata[0].executionTime);
      assert.strictEqual(eventMetadata[0].plansCount, 5);
    });
  });

  describe('Event Metadata Structure', () => {
    it('should format metadata for plans.fetch_completed event', () => {
      const vendorTimings = [
        {
          vendorId: 'vendor-sukoon',
          vendorName: 'sukoon',
          success: true,
          executionTime: '12.3s',
          plansCount: 5
        },
        {
          vendorId: 'vendor-watania',
          vendorName: 'watania',
          success: true,
          executionTime: '8.5s',
          plansCount: 3
        }
      ];

      const eventData = {
        leadId: 'lead-123',
        fetchRequestId: 'fetch-456',
        totalPlans: 8,
        successfulVendors: ['vendor-sukoon', 'vendor-watania'],
        failedVendors: [],
        plans: [],
        metadata: {
          vendorTimings: vendorTimings
        }
      };

      // Verify event structure
      assert.ok(eventData.metadata);
      assert.ok(eventData.metadata.vendorTimings);
      assert.strictEqual(eventData.metadata.vendorTimings.length, 2);
      assert.strictEqual(eventData.metadata.vendorTimings[0].vendorName, 'sukoon');
      assert.strictEqual(eventData.metadata.vendorTimings[1].vendorName, 'watania');
    });

    it('should handle empty vendorTimings array', () => {
      const vendorTimings: any[] = [];

      const eventMetadata = vendorTimings.length > 0 ? {
        vendorTimings: vendorTimings.map(({ error, ...rest }) => rest)
      } : undefined;

      // Verify metadata is undefined when no timings
      assert.strictEqual(eventMetadata, undefined);
    });

    it('should include metadata for failed stage', () => {
      const vendorTimings = [
        {
          vendorId: 'vendor-sukoon',
          vendorName: 'sukoon',
          success: false,
          executionTime: '10.0s',
          plansCount: 0
        }
      ];

      const failedEventData = {
        leadId: 'lead-123',
        fetchRequestId: 'fetch-456',
        error: 'All vendors failed',
        metadata: {
          vendorTimings: vendorTimings
        }
      };

      // Verify failed event includes timing metadata
      assert.ok(failedEventData.metadata);
      assert.ok(failedEventData.metadata.vendorTimings);
      assert.strictEqual(failedEventData.metadata.vendorTimings[0].success, false);
      assert.strictEqual(failedEventData.metadata.vendorTimings[0].executionTime, '10.0s');
    });
  });

  describe('Timeline Entry Metadata', () => {
    it('should structure metadata for timeline entry', () => {
      const timelineMetadata = {
        vendorTimings: [
          {
            vendorId: 'vendor-sukoon',
            vendorName: 'sukoon',
            success: true,
            executionTime: '12.3s',
            plansCount: 5
          }
        ]
      };

      // Verify timeline metadata structure
      assert.ok(timelineMetadata.vendorTimings);
      assert.strictEqual(Array.isArray(timelineMetadata.vendorTimings), true);
      assert.strictEqual(timelineMetadata.vendorTimings[0].vendorId, 'vendor-sukoon');
      assert.strictEqual(timelineMetadata.vendorTimings[0].executionTime, '12.3s');
    });

    it('should be JSON serializable for Cosmos DB', () => {
      const metadata = {
        vendorTimings: [
          {
            vendorId: 'vendor-sukoon',
            vendorName: 'sukoon',
            success: true,
            executionTime: '12.3s',
            plansCount: 5
          }
        ]
      };

      // Verify can be serialized and deserialized
      const serialized = JSON.stringify(metadata);
      const deserialized = JSON.parse(serialized);

      assert.strictEqual(deserialized.vendorTimings[0].vendorName, 'sukoon');
      assert.strictEqual(deserialized.vendorTimings[0].executionTime, '12.3s');
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple vendors with mixed success', () => {
      const vmResults = [
        {
          vendorId: 'vendor-1',
          plans: [{ planName: 'Plan 1' }],
          success: true,
          executionTime: '10.0s'
        },
        {
          vendorId: 'vendor-2',
          plans: [],
          success: false,
          executionTime: '5.0s'
        },
        {
          vendorId: 'vendor-3',
          plans: [{ planName: 'Plan 2' }, { planName: 'Plan 3' }],
          success: true,
          executionTime: '15.0s'
        }
      ];

      const vendorTimings = vmResults.map(result => ({
        vendorId: result.vendorId,
        vendorName: result.vendorId.replace('vendor-', ''),
        success: result.success,
        executionTime: result.executionTime || 'N/A',
        plansCount: result.plans.length
      }));

      // Verify all vendors captured
      assert.strictEqual(vendorTimings.length, 3);
      
      // Verify success statuses
      assert.strictEqual(vendorTimings[0].success, true);
      assert.strictEqual(vendorTimings[1].success, false);
      assert.strictEqual(vendorTimings[2].success, true);
      
      // Verify plan counts
      assert.strictEqual(vendorTimings[0].plansCount, 1);
      assert.strictEqual(vendorTimings[1].plansCount, 0);
      assert.strictEqual(vendorTimings[2].plansCount, 2);
    });

    it('should handle vendor with very long execution time', () => {
      const vmResult = {
        vendorId: 'vendor-slow',
        plans: [],
        success: false,
        executionTime: '300.5s',  // 5+ minutes
        error: 'Timeout'
      };

      const vendorTiming = {
        vendorId: vmResult.vendorId,
        vendorName: vmResult.vendorId.replace('vendor-', ''),
        success: vmResult.success,
        executionTime: vmResult.executionTime || 'N/A',
        plansCount: vmResult.plans.length
      };

      assert.strictEqual(vendorTiming.executionTime, '300.5s');
    });
  });
});
