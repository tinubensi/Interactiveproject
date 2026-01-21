/**
 * Tests for RPA VM Service - Incremental Plan Fetching
 * TDD: Test-first approach for immediate plan persistence
 */
import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';

describe('RpaVmService - Incremental Plan Fetching', () => {
  describe('fetchPlansFromAllVendors', () => {
    it('should save plans immediately when each vendor completes', async () => {
      // RED: This test will fail initially
      // Expected behavior: Plans should be saved to Cosmos DB immediately 
      // when each vendor returns results, not in batch after all complete
      
      const mockLeadId = 'lead-123';
      const mockLeadData = { firstName: 'Test', lastName: 'User' };
      const mockVendorIds = ['vendor-alsagr', 'vendor-watania'];
      
      const savedPlans: Array<{ vendorId: string; timestamp: number }> = [];
      
      // Mock fetchPlansFromVendor to track when each vendor completes
      const vendorCompletionTimes: Record<string, number> = {};
      
      // Simulate vendor 1 completes at 1000ms, vendor 2 at 2000ms
      const mockFetchPlansFromVendor = async (vendorId: string) => {
        const delay = vendorId === 'vendor-alsagr' ? 100 : 200;
        await new Promise(resolve => setTimeout(resolve, delay));
        vendorCompletionTimes[vendorId] = Date.now();
        
        return {
          vendorId,
          plans: [{ planName: `${vendorId}-plan1` }],
          success: true,
          executionTime: `${delay}ms`
        };
      };
      
      // Mock savePlansToCosmosDB to track when saves happen
      const mockSavePlansToCosmosDB = async (leadId: string, vendorId: string, plans: any[]) => {
        savedPlans.push({ vendorId, timestamp: Date.now() });
      };
      
      // Import and mock the service
      const { rpaVmService } = await import('../../services/rpaVmService');
      
      // Override the methods using object assignment for testing
      const originalFetch = (rpaVmService as any).fetchPlansFromVendor;
      const originalSave = (rpaVmService as any).savePlansToCosmosDB;
      
      (rpaVmService as any).fetchPlansFromVendor = mockFetchPlansFromVendor;
      (rpaVmService as any).savePlansToCosmosDB = mockSavePlansToCosmosDB;
      
      try {
        await rpaVmService.fetchPlansFromAllVendors(mockLeadId, mockLeadData, mockVendorIds);
        
        // Assert: Plans should be saved immediately, not in batch
        assert.strictEqual(savedPlans.length, 2, 'Should save plans for both vendors');
        
        // Assert: First vendor's plans should be saved before second vendor completes
        const vendor1SaveTime = savedPlans.find(s => s.vendorId === 'vendor-alsagr')?.timestamp || 0;
        const vendor2CompletionTime = vendorCompletionTimes['vendor-watania'] || 0;
        
        // Vendor 1 save should happen before vendor 2 even completes
        assert.ok(
          vendor1SaveTime < vendor2CompletionTime,
          'Vendor 1 plans should be saved before vendor 2 completes'
        );
      } finally {
        // Restore original methods
        (rpaVmService as any).fetchPlansFromVendor = originalFetch;
        (rpaVmService as any).savePlansToCosmosDB = originalSave;
      }
    });

    it('should save plans concurrently without conflicts', async () => {
      // RED: This test will fail initially
      // Expected: Multiple vendors can save to Cosmos DB concurrently
      
      const mockLeadId = 'lead-456';
      const mockLeadData = { firstName: 'Test' };
      const mockVendorIds = ['vendor-alsagr', 'vendor-watania', 'vendor-sukoon'];
      
      const saveOperations: Array<{ vendorId: string; startTime: number; endTime: number }> = [];
      
      const mockFetchPlansFromVendor = async (vendorId: string) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          vendorId,
          plans: [{ planName: `${vendorId}-plan1` }],
          success: true,
          executionTime: '50ms'
        };
      };
      
      const mockSavePlansToCosmosDB = async (leadId: string, vendorId: string, plans: any[]) => {
        const startTime = Date.now();
        await new Promise(resolve => setTimeout(resolve, 30)); // Simulate save duration
        const endTime = Date.now();
        saveOperations.push({ vendorId, startTime, endTime });
      };
      
      const { rpaVmService } = await import('../../services/rpaVmService');
      const originalFetch = (rpaVmService as any).fetchPlansFromVendor;
      const originalSave = (rpaVmService as any).savePlansToCosmosDB;
      
      (rpaVmService as any).fetchPlansFromVendor = mockFetchPlansFromVendor;
      (rpaVmService as any).savePlansToCosmosDB = mockSavePlansToCosmosDB;
      
      try {
        await rpaVmService.fetchPlansFromAllVendors(mockLeadId, mockLeadData, mockVendorIds);
        
        assert.strictEqual(saveOperations.length, 3, 'Should save plans for all 3 vendors');
        
        // Check that saves happened concurrently (overlapping time windows)
        // If saves were sequential, total time would be 3 * 30ms = 90ms minimum
        // If concurrent, they can overlap
        const firstSaveStart = Math.min(...saveOperations.map(op => op.startTime));
        const lastSaveEnd = Math.max(...saveOperations.map(op => op.endTime));
        const totalDuration = lastSaveEnd - firstSaveStart;
        
        // If truly concurrent, duration should be less than sequential (90ms)
        assert.ok(
          totalDuration < 90,
          `Saves should happen concurrently. Total duration: ${totalDuration}ms`
        );
      } finally {
        (rpaVmService as any).fetchPlansFromVendor = originalFetch;
        (rpaVmService as any).savePlansToCosmosDB = originalSave;
      }
    });

    it('should not block successful vendors when one vendor fails', async () => {
      // RED: This test will fail initially
      // Expected: Failed vendor should not prevent other vendors' plans from being saved
      
      const mockLeadId = 'lead-789';
      const mockLeadData = { firstName: 'Test' };
      const mockVendorIds = ['vendor-alsagr', 'vendor-failing', 'vendor-watania'];
      
      const savedPlans: string[] = [];
      
      const mockFetchPlansFromVendor = async (vendorId: string) => {
        await new Promise(resolve => setTimeout(resolve, 50));
        
        if (vendorId === 'vendor-failing') {
          throw new Error('Vendor API failed');
        }
        
        return {
          vendorId,
          plans: [{ planName: `${vendorId}-plan1` }],
          success: true,
          executionTime: '50ms'
        };
      };
      
      const mockSavePlansToCosmosDB = async (leadId: string, vendorId: string, plans: any[]) => {
        savedPlans.push(vendorId);
      };
      
      const { rpaVmService } = await import('../../services/rpaVmService');
      const originalFetch = (rpaVmService as any).fetchPlansFromVendor;
      const originalSave = (rpaVmService as any).savePlansToCosmosDB;
      
      (rpaVmService as any).fetchPlansFromVendor = mockFetchPlansFromVendor;
      (rpaVmService as any).savePlansToCosmosDB = mockSavePlansToCosmosDB;
      
      try {
        const results = await rpaVmService.fetchPlansFromAllVendors(
          mockLeadId,
          mockLeadData,
          mockVendorIds
        );
        
        // Should have 2 successful saves (alsagr and watania)
        assert.strictEqual(savedPlans.length, 2, 'Should save plans for 2 successful vendors');
        assert.ok(savedPlans.includes('vendor-alsagr'), 'Should include alsagr plans');
        assert.ok(savedPlans.includes('vendor-watania'), 'Should include watania plans');
        assert.ok(!savedPlans.includes('vendor-failing'), 'Should not include failed vendor');
        
        // Results should include all 3 vendors (with one marked as failed)
        assert.strictEqual(results.length, 3, 'Should return results for all vendors');
        const failedResult = results.find(r => r.vendorId === 'vendor-failing');
        assert.strictEqual(failedResult?.success, false, 'Failed vendor should have success=false');
      } finally {
        (rpaVmService as any).fetchPlansFromVendor = originalFetch;
        (rpaVmService as any).savePlansToCosmosDB = originalSave;
      }
    });

    it('should not have 3-second delay after saving plans', async () => {
      // RED: This test will fail initially because current code has 3-second delay
      // Expected: No artificial delay after saves, rely on frontend polling
      
      const mockLeadId = 'lead-999';
      const mockLeadData = { firstName: 'Test' };
      const mockVendorIds = ['vendor-alsagr'];
      
      const mockFetchPlansFromVendor = async (vendorId: string) => {
        return {
          vendorId,
          plans: [{ planName: 'plan1' }],
          success: true,
          executionTime: '10ms'
        };
      };
      
      const mockSavePlansToCosmosDB = async () => {
        // Instant save
      };
      
      const { rpaVmService } = await import('../../services/rpaVmService');
      const originalFetch = (rpaVmService as any).fetchPlansFromVendor;
      const originalSave = (rpaVmService as any).savePlansToCosmosDB;
      
      (rpaVmService as any).fetchPlansFromVendor = mockFetchPlansFromVendor;
      (rpaVmService as any).savePlansToCosmosDB = mockSavePlansToCosmosDB;
      
      try {
        const startTime = Date.now();
        await rpaVmService.fetchPlansFromAllVendors(mockLeadId, mockLeadData, mockVendorIds);
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should complete in under 1 second (no 3-second delay)
        assert.ok(
          duration < 1000,
          `Should complete quickly without delay. Actual duration: ${duration}ms`
        );
      } finally {
        (rpaVmService as any).fetchPlansFromVendor = originalFetch;
        (rpaVmService as any).savePlansToCosmosDB = originalSave;
      }
    });
  });
});
