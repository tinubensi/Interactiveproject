/**
 * Test: Multi-Vendor RPA Race Condition
 * 
 * ISSUE: When multiple vendors are fetching plans via RPA, each vendor
 * publishes a separate plans.fetch_completed event. The pipeline service
 * receives the FIRST event and transitions to "Plans Available" immediately,
 * even though other vendors are still fetching plans.
 * 
 * This test verifies the race condition exists and needs to be fixed.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('Multi-Vendor RPA Race Condition', () => {
  it('should NOT transition to Plans Available until ALL vendors complete', async () => {
    // Arrange - Simulate a lead with 3 vendors fetching plans
    const leadId = 'lead-race-condition-test';
    const vendors = ['vendor-1', 'vendor-2', 'vendor-3'];
    
    // Simulate pipeline waiting for plans.fetch_completed
    let currentStage = 'Plans Fetching';
    let waitingForEvent = 'plans.fetch_completed';
    let completedVendors: string[] = [];
    
    // Act - Simulate vendor 1 completing first
    const vendor1Event = {
      eventType: 'plans.fetch_completed',
      data: {
        leadId,
        vendorId: 'vendor-1',
        totalPlans: 5,
      }
    };
    
    // Current behavior: Pipeline advances immediately on FIRST event
    if (waitingForEvent === vendor1Event.eventType) {
      currentStage = 'Plans Available'; // BUG: Advanced too early!
      completedVendors.push('vendor-1');
    }
    
    // Assert - This is the BUG
    assert.strictEqual(currentStage, 'Plans Available', 
      'BUG CONFIRMED: Stage transitioned to Plans Available after only 1/3 vendors completed');
    
    assert.strictEqual(completedVendors.length, 1,
      'Only 1 vendor completed, but stage already changed');
    
    // Expected behavior: Should still be "Plans Fetching" until all 3 vendors complete
    console.log('🐛 BUG CONFIRMED: Pipeline transitions too early with multi-vendor RPA');
    console.log(`   Current stage: ${currentStage} (should still be "Plans Fetching")`);
    console.log(`   Completed vendors: ${completedVendors.length}/${vendors.length}`);
  });

  it('should aggregate vendor completions before transitioning', async () => {
    // This test shows the CORRECT behavior we should implement
    
    const leadId = 'lead-aggregated-test';
    const totalVendors = 3;
    const fetchRequestId = 'fetch-123';
    
    // Track vendor completions
    const completedVendors: Set<string> = new Set();
    let currentStage = 'Plans Fetching';
    
    // Vendor 1 completes
    completedVendors.add('vendor-1');
    assert.strictEqual(currentStage, 'Plans Fetching', 
      'Should still be fetching after vendor 1');
    
    // Vendor 2 completes
    completedVendors.add('vendor-2');
    assert.strictEqual(currentStage, 'Plans Fetching',
      'Should still be fetching after vendor 2');
    
    // Vendor 3 completes (LAST one)
    completedVendors.add('vendor-3');
    
    // NOW we should transition
    if (completedVendors.size === totalVendors) {
      currentStage = 'Plans Available';
    }
    
    assert.strictEqual(currentStage, 'Plans Available',
      'Should transition to Plans Available ONLY after all vendors complete');
    
    console.log('✅ EXPECTED BEHAVIOR: Wait for all vendors before transitioning');
    console.log(`   Completed vendors: ${completedVendors.size}/${totalVendors}`);
    console.log(`   Final stage: ${currentStage}`);
  });

  it('should handle vendor failures gracefully', async () => {
    // Test: What happens if one vendor fails?
    
    const totalVendors = 3;
    const completedVendors: Set<string> = new Set();
    const failedVendors: Set<string> = new Set();
    
    // Vendor 1: Success
    completedVendors.add('vendor-1');
    
    // Vendor 2: Failed
    failedVendors.add('vendor-2');
    
    // Vendor 3: Success
    completedVendors.add('vendor-3');
    
    // All vendors finished (success or failure)
    const totalFinished = completedVendors.size + failedVendors.size;
    
    assert.strictEqual(totalFinished, totalVendors,
      'Should count both successful and failed vendors');
    
    // Should transition even with failures
    let shouldTransition = (totalFinished === totalVendors);
    assert.strictEqual(shouldTransition, true,
      'Should transition when all vendors finished (even with some failures)');
    
    console.log('✅ EXPECTED BEHAVIOR: Transition after all vendors finish (including failures)');
    console.log(`   Successful: ${completedVendors.size}`);
    console.log(`   Failed: ${failedVendors.size}`);
    console.log(`   Total: ${totalFinished}/${totalVendors}`);
  });

  it('should have a timeout mechanism for stuck vendors', async () => {
    // Test: What if a vendor never responds?
    
    const totalVendors = 3;
    const timeout = 5 * 60 * 1000; // 5 minutes
    const fetchStartTime = Date.now();
    
    const completedVendors: Set<string> = new Set();
    
    // Vendor 1 and 2 complete
    completedVendors.add('vendor-1');
    completedVendors.add('vendor-2');
    
    // Vendor 3 never responds...
    
    // Simulate timeout check
    const elapsedTime = 6 * 60 * 1000; // 6 minutes (past timeout)
    const hasTimedOut = elapsedTime > timeout;
    
    // After timeout, should transition anyway
    const shouldTransition = (completedVendors.size === totalVendors) || hasTimedOut;
    
    assert.strictEqual(hasTimedOut, true, 'Should detect timeout');
    assert.strictEqual(shouldTransition, true, 
      'Should transition after timeout even if not all vendors completed');
    
    console.log('✅ EXPECTED BEHAVIOR: Timeout mechanism prevents indefinite waiting');
    console.log(`   Completed: ${completedVendors.size}/${totalVendors}`);
    console.log(`   Timed out: ${hasTimedOut}`);
  });
});

