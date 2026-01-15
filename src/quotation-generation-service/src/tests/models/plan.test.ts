/**
 * Tests for Plan Model Interface
 * TDD: Test-first approach for unified plan structure
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import type { Plan, BenefitCategory, BenefitDetail } from '../../models/plan';

describe('Plan Model Interface - Unified Structure', () => {
  
  describe('Required Fields Validation', () => {
    it('should accept plan with all required fields', () => {
      const plan: Plan = {
        id: 'plan-123',
        leadId: 'lead-456',
        vendorId: 'takaful',
        vendorName: 'Takaful Emarat',
        vendorCode: 'TKF',
        planName: 'Gold Plan',
        planCode: 'TKF-GOL',
        planType: 'gold',
        annualPremium: 10000,
        monthlyPremium: 833.33,
        currency: 'AED',
        annualLimit: 500000,
        deductible: 1000,
        coInsurance: 20,
        waitingPeriod: 30,
        benefits: [],
        exclusions: [],
        lineOfBusiness: 'medical',
        isAvailable: true,
        isSelected: false,
        isRecommended: false,
        fetchRequestId: 'req-789',
        fetchedAt: new Date(),
        source: 'rpa'
      };
      
      // TypeScript compilation validates the structure
      assert.ok(plan);
      assert.strictEqual(plan.id, 'plan-123');
      assert.strictEqual(plan.leadId, 'lead-456');
    });
  });

  describe('Optional CoverageLimits Sub-fields', () => {
    it('should accept plan without coverageLimits sub-fields', () => {
      const plan: Plan = {
        id: 'plan-123',
        leadId: 'lead-456',
        vendorId: 'takaful',
        vendorName: 'Takaful Emarat',
        vendorCode: 'TKF',
        planName: 'Bronze Plan',
        planCode: 'TKF-BRO',
        planType: 'bronze',
        annualPremium: 5000,
        monthlyPremium: 416.67,
        currency: 'AED',
        annualLimit: 150000,
        deductible: 500,
        coInsurance: 20,
        waitingPeriod: 30,
        benefits: [],
        exclusions: [],
        lineOfBusiness: 'medical',
        isAvailable: true,
        isSelected: false,
        isRecommended: false,
        fetchRequestId: 'req-789',
        fetchedAt: new Date(),
        source: 'rpa'
      };
      
      assert.strictEqual(plan.annualLimit, 150000);
    });

    it('should accept plan with optional inpatient and outpatient limits', () => {
      const plan: Partial<Plan> & Pick<Plan, 'id' | 'leadId'> = {
        id: 'plan-123',
        leadId: 'lead-456',
        // Optional fields that should be accepted
        inpatientLimit: 100000,
        outpatientLimit: 50000,
        maternityLimit: 25000,
        pharmacyLimit: 10000,
        dentalLimit: 2000,
        opticalLimit: 1000,
        emergencyLimit: 20000
      };
      
      // These should compile without errors
      assert.strictEqual(plan.inpatientLimit, 100000);
      assert.strictEqual(plan.outpatientLimit, 50000);
      assert.strictEqual(plan.maternityLimit, 25000);
    });
  });

  describe('Optional Network Object', () => {
    it('should accept plan with network information', () => {
      const plan: Partial<Plan> & Pick<Plan, 'id' | 'leadId'> = {
        id: 'plan-123',
        leadId: 'lead-456',
        network: {
          tpa: 'E-Care',
          networkName: 'E-Care Network',
          networkType: 'premium'
        }
      };
      
      assert.ok(plan.network);
      assert.strictEqual(plan.network?.tpa, 'E-Care');
      assert.strictEqual(plan.network?.networkName, 'E-Care Network');
    });

    it('should accept plan without network information', () => {
      const plan: Partial<Plan> & Pick<Plan, 'id' | 'leadId'> = {
        id: 'plan-123',
        leadId: 'lead-456'
      };
      
      assert.strictEqual(plan.network, undefined);
    });
  });

  describe('Optional WaitingPeriods Object', () => {
    it('should accept plan with detailed waiting periods', () => {
      const plan: Partial<Plan> & Pick<Plan, 'id' | 'leadId'> = {
        id: 'plan-123',
        leadId: 'lead-456',
        waitingPeriod: 30,
        waitingPeriods: {
          general: 30,
          maternity: 280,
          preexisting: 365,
          dental: 90,
          optical: 60
        }
      };
      
      assert.ok(plan.waitingPeriods);
      assert.strictEqual(plan.waitingPeriods?.general, 30);
      assert.strictEqual(plan.waitingPeriods?.maternity, 280);
      assert.strictEqual(plan.waitingPeriods?.preexisting, 365);
    });

    it('should accept plan with only primary waitingPeriod', () => {
      const plan: Partial<Plan> & Pick<Plan, 'id' | 'leadId'> = {
        id: 'plan-123',
        leadId: 'lead-456',
        waitingPeriod: 30
      };
      
      assert.strictEqual(plan.waitingPeriod, 30);
      assert.strictEqual(plan.waitingPeriods, undefined);
    });
  });

  describe('BenefitCategory Structure', () => {
    it('should validate benefit category with proper structure', () => {
      const benefitCategory: BenefitCategory = {
        categoryId: 'inpatient',
        categoryName: 'Inpatient Care',
        benefits: [
          {
            name: 'Hospital Room',
            covered: true,
            limit: 1500,
            limitMetric: 'AED',
            description: 'Private room up to AED 1,500 per night'
          },
          {
            name: 'ICU Coverage',
            covered: true,
            limit: 3000,
            limitMetric: 'AED'
          }
        ]
      };
      
      assert.strictEqual(benefitCategory.categoryId, 'inpatient');
      assert.strictEqual(benefitCategory.benefits.length, 2);
      assert.strictEqual(benefitCategory.benefits[0].name, 'Hospital Room');
      assert.strictEqual(benefitCategory.benefits[0].limit, 1500);
    });

    it('should accept benefit without limit', () => {
      const benefit: BenefitDetail = {
        name: 'Maternity Coverage',
        covered: true,
        description: 'Full maternity coverage included'
      };
      
      assert.strictEqual(benefit.limit, undefined);
      assert.strictEqual(benefit.covered, true);
    });

    it('should accept benefit with sub-benefits', () => {
      const benefit: BenefitDetail = {
        name: 'Maternity',
        covered: true,
        subBenefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 8000,
            limitMetric: 'AED'
          }
        ]
      };
      
      assert.strictEqual(benefit.subBenefits?.length, 2);
      assert.strictEqual(benefit.subBenefits?.[0].name, 'Normal Delivery');
    });
  });

  describe('Comprehensive Plan Example', () => {
    it('should accept fully detailed plan from all vendors', () => {
      const comprehensivePlan: Plan = {
        // Core identification
        id: 'plan-comprehensive-123',
        leadId: 'lead-456',
        
        // Vendor info
        vendorId: 'watania',
        vendorName: 'Watania Takaful',
        vendorCode: 'WTN',
        
        // Plan details
        planName: 'Class A NE1 (0-45) V4',
        planCode: 'WTN-CLA-A-NE1',
        planType: 'platinum',
        
        // Pricing
        annualPremium: 75000,
        monthlyPremium: 6250,
        currency: 'AED',
        
        // Coverage limits (annualLimit is required, others optional)
        annualLimit: 600000,
        inpatientLimit: 400000,
        outpatientLimit: 50000,
        maternityLimit: 25000,
        emergencyLimit: 10000,
        pharmacyLimit: 15000,
        dentalLimit: 5000,
        opticalLimit: 2000,
        
        // Cost sharing
        deductible: 1000,
        deductibleMetric: 'AED',
        coInsurance: 20,
        coInsuranceMetric: '%',
        
        // Waiting periods
        waitingPeriod: 30,
        waitingPeriodMetric: 'days',
        waitingPeriods: {
          general: 30,
          maternity: 280,
          preexisting: 365
        },
        
        // Network (optional)
        network: {
          tpa: 'MedNet',
          networkName: 'MedNet Network',
          networkType: 'standard'
        },
        
        // Benefits
        benefits: [
          {
            categoryId: 'inpatient',
            categoryName: 'Inpatient Care',
            benefits: [
              {
                name: 'Hospital Room',
                covered: true,
                limit: 1500,
                limitMetric: 'AED',
                description: 'Private room up to AED 1,500 per night'
              }
            ]
          }
        ],
        
        // Exclusions
        exclusions: [
          'Pre-existing conditions subject to medical underwriting',
          'Cosmetic procedures not covered'
        ],
        
        // Metadata
        lineOfBusiness: 'medical',
        lobSpecificData: {
          networkProviders: 'MedNet',
          copayTestMedicine: '20%',
          copayConsultation: '20%'
        },
        isAvailable: true,
        isSelected: false,
        isRecommended: true,
        fetchRequestId: 'req-789',
        fetchedAt: new Date(),
        source: 'rpa',
        
        // Raw data
        rawPlanData: {
          source: 'watania_comprehensive',
          extractedFields: ['all']
        }
      };
      
      assert.ok(comprehensivePlan);
      assert.strictEqual(comprehensivePlan.inpatientLimit, 400000);
      assert.strictEqual(comprehensivePlan.network?.tpa, 'MedNet');
      assert.strictEqual(comprehensivePlan.waitingPeriods?.maternity, 280);
      assert.strictEqual(comprehensivePlan.benefits.length, 1);
    });
  });

  describe('Backward Compatibility', () => {
    it('should work with minimal plan structure (old format)', () => {
      const minimalPlan: Plan = {
        id: 'plan-minimal-123',
        leadId: 'lead-456',
        vendorId: 'takaful',
        vendorName: 'Takaful Emarat',
        vendorCode: 'TKF',
        planName: 'Basic Plan',
        planCode: 'TKF-BAS',
        planType: 'bronze',
        annualPremium: 3000,
        monthlyPremium: 250,
        currency: 'AED',
        annualLimit: 100000,
        deductible: 0,
        coInsurance: 0,
        waitingPeriod: 30,
        benefits: [],
        exclusions: [],
        lineOfBusiness: 'medical',
        isAvailable: true,
        isSelected: false,
        isRecommended: false,
        fetchRequestId: 'req-789',
        fetchedAt: new Date(),
        source: 'rpa'
      };
      
      // Should work without optional fields
      assert.strictEqual(minimalPlan.inpatientLimit, undefined);
      assert.strictEqual(minimalPlan.network, undefined);
      assert.strictEqual(minimalPlan.waitingPeriods, undefined);
    });
  });

  describe('Type Safety', () => {
    it('should enforce correct LineOfBusiness types', () => {
      const validLOB: Plan['lineOfBusiness'] = 'medical';
      assert.strictEqual(validLOB, 'medical');
    });

    it('should enforce correct PlanSource types', () => {
      const validSource: Plan['source'] = 'rpa';
      assert.strictEqual(validSource, 'rpa');
    });
  });
});
