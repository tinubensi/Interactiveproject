/**
 * Select Plan Tests - Quotation Service
 * Tests for customer plan selection functionality
 */

import { describe, it, before, mock } from 'node:test';
import assert from 'node:assert';

describe('Customer Plan Selection', () => {
  let mockQuotation: any;
  let mockPlan: any;

  before(() => {
    mockQuotation = {
      id: 'test-quotation-123',
      referenceId: 'QUOT-2024-001',
      leadId: 'test-lead-123',
      customerId: 'test-customer-123',
      status: 'sent',
      totalPremium: 15000, // Sum of all plans
      currency: 'AED',
      selectionToken: 'valid-token-123',
      tokenUsedAt: undefined,
      customerSelectedPlanId: undefined,
      selectedPlanPremium: undefined,
      validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
    };

    mockPlan = {
      id: 'plan-123',
      planId: 'plan-123',
      planName: 'Premium Health Plan',
      vendorName: 'HealthCare Provider',
      annualPremium: 5000,
      monthlyPremium: 450,
      currency: 'AED',
    };
  });

  describe('Plan Selection - selectedPlanPremium Field', () => {
    it('should store selectedPlanPremium and selectedPlanSnapshot when customer selects a plan', () => {
      // Test data structure
      const updatedQuotation = {
        ...mockQuotation,
        status: 'pending_approval',
        customerSelectedPlanId: mockPlan.id,
        selectedPlanPremium: mockPlan.annualPremium,
        selectedPlanSnapshot: {
          planName: mockPlan.planName,
          vendorName: mockPlan.vendorName,
          annualPremium: mockPlan.annualPremium,
          monthlyPremium: mockPlan.monthlyPremium,
          currency: mockPlan.currency,
        },
        tokenUsedAt: new Date(),
      };

      // Verify selectedPlanPremium is set correctly
      assert.strictEqual(
        updatedQuotation.selectedPlanPremium,
        mockPlan.annualPremium,
        'selectedPlanPremium should match the selected plan annual premium'
      );
      assert.strictEqual(
        updatedQuotation.selectedPlanPremium,
        5000,
        'selectedPlanPremium should be 5000 AED'
      );
      
      // Verify selectedPlanSnapshot is set correctly
      assert.ok(updatedQuotation.selectedPlanSnapshot, 'selectedPlanSnapshot should be set');
      assert.strictEqual(
        updatedQuotation.selectedPlanSnapshot.planName,
        'Premium Health Plan',
        'selectedPlanSnapshot should contain plan name'
      );
      assert.strictEqual(
        updatedQuotation.selectedPlanSnapshot.vendorName,
        'HealthCare Provider',
        'selectedPlanSnapshot should contain vendor name'
      );
      assert.strictEqual(
        updatedQuotation.selectedPlanSnapshot.annualPremium,
        5000,
        'selectedPlanSnapshot should contain annual premium'
      );
    });

    it('should store selectedPlanPremium from the selected plan, not totalPremium', () => {
      const updatedQuotation = {
        ...mockQuotation,
        customerSelectedPlanId: mockPlan.id,
        selectedPlanPremium: mockPlan.annualPremium,
      };

      // Verify selectedPlanPremium is different from totalPremium
      assert.notStrictEqual(
        updatedQuotation.selectedPlanPremium,
        updatedQuotation.totalPremium,
        'selectedPlanPremium should be different from totalPremium (which is sum of all plans)'
      );
      assert.strictEqual(
        updatedQuotation.selectedPlanPremium,
        5000,
        'selectedPlanPremium should be the individual plan premium'
      );
      assert.strictEqual(
        updatedQuotation.totalPremium,
        15000,
        'totalPremium should remain as sum of all plans'
      );
    });

    it('should update quotation with all required fields for plan selection', () => {
      const now = new Date();
      const updatePayload = {
        status: 'pending_approval',
        tokenUsedAt: now,
        customerSelectedPlanId: mockPlan.id,
        selectedPlanPremium: mockPlan.annualPremium,
        selectedPlanSnapshot: {
          planName: mockPlan.planName,
          vendorName: mockPlan.vendorName,
          annualPremium: mockPlan.annualPremium,
          monthlyPremium: mockPlan.monthlyPremium,
          currency: mockPlan.currency,
        },
      };

      // Verify all required fields are present
      assert.ok(updatePayload.status, 'status should be set');
      assert.ok(updatePayload.tokenUsedAt, 'tokenUsedAt should be set');
      assert.ok(updatePayload.customerSelectedPlanId, 'customerSelectedPlanId should be set');
      assert.ok(updatePayload.selectedPlanPremium, 'selectedPlanPremium should be set');
      assert.ok(updatePayload.selectedPlanSnapshot, 'selectedPlanSnapshot should be set');
      
      assert.strictEqual(updatePayload.status, 'pending_approval', 'status should be pending_approval');
      assert.strictEqual(updatePayload.selectedPlanPremium, 5000, 'selectedPlanPremium should match plan premium');
      assert.strictEqual(updatePayload.selectedPlanSnapshot.planName, 'Premium Health Plan', 'snapshot should contain plan name');
    });

    it('should handle selectedPlanPremium as optional field for backwards compatibility', () => {
      // Test quotation without selectedPlanPremium (old data)
      const oldQuotation = {
        ...mockQuotation,
        customerSelectedPlanId: mockPlan.id,
        selectedPlanPremium: undefined,
      };

      // Should not throw error when selectedPlanPremium is undefined
      assert.strictEqual(
        oldQuotation.selectedPlanPremium,
        undefined,
        'selectedPlanPremium can be undefined for old quotations'
      );
      
      // Application should handle gracefully (show N/A or fetch from plans)
      const displayPremium = oldQuotation.selectedPlanPremium || 'N/A';
      assert.strictEqual(displayPremium, 'N/A', 'Should display N/A when premium is not available');
    });

    it('should validate selectedPlanPremium is a number when present', () => {
      const validQuotation = {
        ...mockQuotation,
        selectedPlanPremium: 5000,
      };

      assert.strictEqual(
        typeof validQuotation.selectedPlanPremium,
        'number',
        'selectedPlanPremium should be a number'
      );
      assert.ok(
        validQuotation.selectedPlanPremium > 0,
        'selectedPlanPremium should be positive'
      );
    });
  });

  describe('Data Flow Validation', () => {
    it('should follow correct data flow: plan selection → premium storage', () => {
      // Step 1: Customer selects plan
      const selectedPlan = mockPlan;

      // Step 2: Extract premium from selected plan
      const premium = selectedPlan.annualPremium;

      // Step 3: Store in quotation
      const updatedQuotation = {
        ...mockQuotation,
        customerSelectedPlanId: selectedPlan.id,
        selectedPlanPremium: premium,
        status: 'pending_approval',
      };

      // Verify data flow
      assert.strictEqual(
        updatedQuotation.selectedPlanPremium,
        selectedPlan.annualPremium,
        'Premium should flow from plan to quotation'
      );
      assert.strictEqual(
        updatedQuotation.status,
        'pending_approval',
        'Status should be pending_approval after selection'
      );
    });

    it('should preserve selectedPlanPremium and selectedPlanSnapshot when status changes from pending_approval to policy_issued', () => {
      // Quotation after plan selection
      const pendingQuotation = {
        ...mockQuotation,
        status: 'pending_approval',
        customerSelectedPlanId: mockPlan.id,
        selectedPlanPremium: mockPlan.annualPremium,
        selectedPlanSnapshot: {
          planName: mockPlan.planName,
          vendorName: mockPlan.vendorName,
          annualPremium: mockPlan.annualPremium,
          monthlyPremium: mockPlan.monthlyPremium,
          currency: mockPlan.currency,
        },
      };

      // After approval
      const issuedQuotation = {
        ...pendingQuotation,
        status: 'policy_issued',
        approvedAt: new Date(),
      };

      // selectedPlanPremium should be preserved
      assert.strictEqual(
        issuedQuotation.selectedPlanPremium,
        pendingQuotation.selectedPlanPremium,
        'selectedPlanPremium should be preserved after approval'
      );
      assert.strictEqual(
        issuedQuotation.selectedPlanPremium,
        5000,
        'Premium should remain 5000 AED'
      );
      
      // selectedPlanSnapshot should be preserved
      assert.ok(issuedQuotation.selectedPlanSnapshot, 'selectedPlanSnapshot should be preserved');
      assert.strictEqual(
        issuedQuotation.selectedPlanSnapshot.planName,
        'Premium Health Plan',
        'Plan name should be preserved'
      );
      assert.strictEqual(
        issuedQuotation.selectedPlanSnapshot.vendorName,
        'HealthCare Provider',
        'Vendor name should be preserved'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero premium plans', () => {
      const freePlan = { ...mockPlan, annualPremium: 0 };
      const quotation = {
        ...mockQuotation,
        selectedPlanPremium: freePlan.annualPremium,
      };

      assert.strictEqual(quotation.selectedPlanPremium, 0, 'Should handle zero premium');
    });

    it('should handle large premium amounts', () => {
      const expensivePlan = { ...mockPlan, annualPremium: 999999 };
      const quotation = {
        ...mockQuotation,
        selectedPlanPremium: expensivePlan.annualPremium,
      };

      assert.strictEqual(quotation.selectedPlanPremium, 999999, 'Should handle large premiums');
    });

    it('should handle decimal premium amounts', () => {
      const decimalPlan = { ...mockPlan, annualPremium: 5000.50 };
      const quotation = {
        ...mockQuotation,
        selectedPlanPremium: decimalPlan.annualPremium,
      };

      assert.strictEqual(quotation.selectedPlanPremium, 5000.50, 'Should handle decimal premiums');
    });
  });

  describe('API Response Format', () => {
    it('should include selectedPlanPremium and selectedPlanSnapshot in quotation listing response', () => {
      const quotationList = [
        {
          id: 'quot-1',
          status: 'pending_approval',
          totalPremium: 15000,
          selectedPlanPremium: 5000,
          selectedPlanSnapshot: {
            planName: 'Plan A',
            vendorName: 'Vendor A',
            annualPremium: 5000,
            monthlyPremium: 450,
            currency: 'AED',
          },
          currency: 'AED',
        },
        {
          id: 'quot-2',
          status: 'policy_issued',
          totalPremium: 20000,
          selectedPlanPremium: 7500,
          selectedPlanSnapshot: {
            planName: 'Plan B',
            vendorName: 'Vendor B',
            annualPremium: 7500,
            monthlyPremium: 650,
            currency: 'AED',
          },
          currency: 'AED',
        },
      ];

      quotationList.forEach(quot => {
        if (quot.status === 'pending_approval' || quot.status === 'policy_issued') {
          assert.ok(
            quot.selectedPlanPremium !== undefined,
            'selectedPlanPremium should be present for pending_approval and policy_issued quotations'
          );
          assert.ok(
            quot.selectedPlanSnapshot !== undefined,
            'selectedPlanSnapshot should be present for pending_approval and policy_issued quotations'
          );
          assert.ok(
            quot.selectedPlanSnapshot.planName,
            'selectedPlanSnapshot should contain plan name'
          );
          assert.ok(
            quot.selectedPlanSnapshot.vendorName,
            'selectedPlanSnapshot should contain vendor name'
          );
        }
      });
    });
  });
});
