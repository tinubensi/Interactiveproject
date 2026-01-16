/**
 * Tests for Plan Fetching Service Transformer - Unified Structure V2
 * TDD: Test-first approach for transformer enhancement
 */
import { describe, it } from 'node:test';
import assert from 'node:assert';

// Mock test data
const mockStandardPlanWithSubLimits = {
  id: 'plan-123',
  leadId: 'lead-456',
  vendorId: 'alsagr',
  vendorName: 'AlSagr Insurance',
  vendorCode: 'ALS',
  planName: 'Gold Plan',
  planCode: 'ALS-GOL',
  planType: 'gold',
  annualPremium: 12000,
  monthlyPremium: 1000,
  currency: 'AED',
  annualLimit: 300000,
  inpatientLimit: 200000,
  outpatientLimit: 50000,
  maternityLimit: 15000,
  pharmacyLimit: 10000,
  dentalLimit: 3000,
  opticalLimit: 1500,
  emergencyLimit: 50000,
  deductible: 500,
  coInsurance: 20,
  waitingPeriod: 30,
  benefits: [
    {
      categoryId: 'inpatient',
      categoryName: 'Inpatient Care',
      benefits: [
        { name: 'Room & Board', covered: true }
      ]
    }
  ],
  exclusions: ['Pre-existing conditions'],
  lineOfBusiness: 'medical',
  isAvailable: true,
  isSelected: false,
  isRecommended: false,
  fetchedAt: new Date().toISOString(),
  source: 'rpa',
  rawPlanData: {}
};

const mockStandardPlanWithNetwork = {
  ...mockStandardPlanWithSubLimits,
  network: {
    tpa: 'E-Care',
    networkName: 'E-Care Network',
    networkType: 'premium'
  }
};

const mockStandardPlanWithCopays = {
  ...mockStandardPlanWithSubLimits,
  copays: {
    gpVisit: 50,
    specialistVisit: 100,
    emergency: 150,
    percentage: 20,
    maxAmount: 100
  }
};

const mockStandardPlanWithWaitingPeriods = {
  ...mockStandardPlanWithSubLimits,
  waitingPeriods: {
    general: 30,
    maternity: 300,
    preexisting: 180,
    dental: 90,
    optical: 60
  }
};

describe('Plan Fetching Service Transformer - Unified Structure V2', () => {
  
  describe('transformStandardPlanToPlan', () => {
    it('should transform sub-limits to coverageLimits object', () => {
      // The transformer should create a coverageLimits object from individual sub-limit fields
      const result = transformStandardPlanToPlan(mockStandardPlanWithSubLimits, 'fetch-123');
      
      assert.ok(result.coverageLimits);
      assert.strictEqual(result.coverageLimits.annualLimit, 300000);
      assert.strictEqual(result.coverageLimits.inpatientLimit, 200000);
      assert.strictEqual(result.coverageLimits.outpatientLimit, 50000);
      assert.strictEqual(result.coverageLimits.maternityLimit, 15000);
    });
    
    it('should preserve network object when present', () => {
      const result = transformStandardPlanToPlan(mockStandardPlanWithNetwork, 'fetch-123');
      
      assert.ok(result.network);
      assert.strictEqual(result.network.tpa, 'E-Care');
      assert.strictEqual(result.network.networkName, 'E-Care Network');
      assert.strictEqual(result.network.networkType, 'premium');
    });
    
    it('should handle missing network gracefully', () => {
      const result = transformStandardPlanToPlan(mockStandardPlanWithSubLimits, 'fetch-123');
      
      // Network should be undefined if not in source data
      assert.ok(!result.network);
    });
    
    it('should preserve copays structure', () => {
      const result = transformStandardPlanToPlan(mockStandardPlanWithCopays, 'fetch-123');
      
      assert.ok(result.costSharing.copays);
      assert.strictEqual(result.costSharing.copays.gpVisit, 50);
      assert.strictEqual(result.costSharing.copays.specialistVisit, 100);
    });
    
    it('should transform waitingPeriods to structured object', () => {
      const result = transformStandardPlanToPlan(mockStandardPlanWithWaitingPeriods, 'fetch-123');
      
      assert.ok(result.waitingPeriods);
      assert.strictEqual(result.waitingPeriods.general, 30);
      assert.strictEqual(result.waitingPeriods.maternity, 300);
      assert.strictEqual(result.waitingPeriods.preexisting, 180);
    });
    
    it('should maintain backward compatibility with old format', () => {
      const oldFormatPlan = {
        id: 'plan-old',
        leadId: 'lead-old',
        vendorId: 'old-vendor',
        vendorName: 'Old Vendor',
        planName: 'Old Plan',
        annualPremium: 5000,
        coverageAmount: 100000, // Old field name
        deductible: 0,
        coInsurance: 0,
        waitingPeriod: 30,
        benefits: ['Benefit 1', 'Benefit 2'],
        exclusions: [],
        fetchedAt: new Date().toISOString()
      };
      
      const result = transformStandardPlanToPlan(oldFormatPlan, 'fetch-123');
      
      // Should handle old coverageAmount field
      assert.strictEqual(result.coverageLimits.annualLimit, 100000);
      assert.strictEqual(result.costSharing.deductible, 0);
    });
    
    it('should not include sub-limits if not present in source', () => {
      const minimalPlan = {
        ...mockStandardPlanWithSubLimits,
        inpatientLimit: undefined,
        outpatientLimit: undefined,
        maternityLimit: undefined
      };
      delete minimalPlan.inpatientLimit;
      delete minimalPlan.outpatientLimit;
      delete minimalPlan.maternityLimit;
      
      const result = transformStandardPlanToPlan(minimalPlan, 'fetch-123');
      
      // coverageLimits should only have annualLimit
      assert.ok(result.coverageLimits.annualLimit);
      assert.strictEqual(result.coverageLimits.inpatientLimit, undefined);
    });
    
    it('should transform benefits correctly', () => {
      const result = transformStandardPlanToPlan(mockStandardPlanWithSubLimits, 'fetch-123');
      
      assert.ok(Array.isArray(result.benefits));
      assert.ok(result.benefits.length > 0);
      assert.strictEqual(result.benefits[0].categoryName, 'Inpatient Care');
    });
  });
});

// Helper function signature (to be implemented in planFetchingService.ts)
function transformStandardPlanToPlan(standardPlan: any, fetchRequestId: string): any {
  throw new Error('Not implemented - this is a test specification');
}

export { mockStandardPlanWithSubLimits, mockStandardPlanWithNetwork };
