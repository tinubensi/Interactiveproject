/**
 * Policy Issuance Service Tests
 * Following TDD protocol - testing behavior, not implementation
 */

// Set environment variables before any imports
process.env.COSMOS_DB_ENDPOINT = 'https://localhost:8081';
process.env.COSMOS_DB_KEY = 'test-key';
process.env.COSMOS_DB_NAME = 'test-db';
process.env.QUOTATION_SERVICE_URL = 'http://localhost:7081';

import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import axios from 'axios';
import { cosmosService } from './cosmosService';
import { policyIssuanceService } from './policyIssuanceService';

// Mock data
const mockQuotation = {
  id: 'quot-123',
  referenceId: 'QUOT-2024-001',
  leadId: 'lead-123',
  customerId: 'customer-123',
  lineOfBusiness: 'motor',
  businessType: 'individual',
  totalPremium: 3500,
  currency: 'AED',
  validUntil: new Date('2024-12-31'),
  createdAt: new Date('2024-01-01'),
  leadSnapshot: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
  },
};

const mockPlan = {
  id: 'plan-123',
  planId: 'plan-123',
  vendorId: 'vendor-abc',
  vendorName: 'Test Insurance Co',
  vendorCode: 'TIC001',
  planName: 'Comprehensive Motor Plan',
  planType: 'comprehensive',
  annualPremium: 3500,
  monthlyPremium: 291.67,
  annualLimit: 500000,
  deductible: 1000,
  coInsurance: 10,
  fullPlanData: { /* full plan details */ },
};

describe('PolicyIssuanceService', () => {
  let axiosGetStub: any;
  let cosmosCreatePolicyStub: any;

  before(() => {
    // Mock cosmosService.createPolicy to prevent actual DB calls
    cosmosCreatePolicyStub = mock.method(cosmosService, 'createPolicy', async (policy: any) => policy);

    // Mock axios.get calls
    axiosGetStub = mock.method(axios, 'get', async (url: string) => {
      if (url.includes('/api/quotations/')) {
        if (url.includes('/plans')) {
          // Return plans list
          return {
            data: {
              success: true,
              data: [mockPlan],
            },
          };
        } else {
          // Return quotation
          return {
            data: {
              success: true,
              data: mockQuotation,
            },
          };
        }
      }
      throw new Error('Unknown URL');
    });
  });

  after(() => {
    // Restore mocks
    axiosGetStub.mock.restore();
    cosmosCreatePolicyStub.mock.restore();
  });

  describe('issuePolicy', () => {
    it('should create a policy with correct lineOfBusiness from quotation', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.lineOfBusiness, 'motor', 'Should use lineOfBusiness from quotation');
      assert.notStrictEqual(policy.lineOfBusiness, 'medical', 'Should not use hardcoded medical value');
    });

    it('should create a policy with correct businessType from quotation', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.businessType, 'individual', 'Should use businessType from quotation');
    });

    it('should create a policy with vendor information from selected plan', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.vendorId, 'vendor-abc', 'Should use vendorId from plan');
      assert.strictEqual(policy.vendorName, 'Test Insurance Co', 'Should use vendorName from plan');
      assert.strictEqual(policy.vendorCode, 'TIC001', 'Should use vendorCode from plan');
    });

    it('should create a policy with financial details from selected plan', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.annualPremium, 3500, 'Should use annualPremium from plan');
      assert.strictEqual(policy.monthlyPremium, 291.67, 'Should use monthlyPremium from plan');
      assert.strictEqual(policy.currency, 'AED', 'Should use currency from quotation');
    });

    it('should create a policy with coverage details from selected plan', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.annualLimit, 500000, 'Should use annualLimit from plan');
      assert.strictEqual(policy.deductible, 1000, 'Should use deductible from plan');
      assert.strictEqual(policy.coInsurance, 10, 'Should use coInsurance from plan');
    });

    it('should set policyRequestId to undefined when created directly from quotation', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.policyRequestId, undefined, 'policyRequestId should be undefined');
    });

    it('should generate a unique policy number', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy1 = await policyIssuanceService.issuePolicy(params);
      const policy2 = await policyIssuanceService.issuePolicy(params);

      assert.ok(policy1.policyNumber, 'Should have a policy number');
      assert.ok(policy2.policyNumber, 'Should have a policy number');
      assert.notStrictEqual(policy1.policyNumber, policy2.policyNumber, 'Policy numbers should be unique');
      assert.ok(policy1.policyNumber.startsWith('POL-'), 'Policy number should start with POL-');
    });

    it('should set policy status to active', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.status, 'active', 'Policy status should be active');
    });

    it('should set policy as renewable with renewal date', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.strictEqual(policy.isRenewable, true, 'Policy should be renewable');
      assert.ok(policy.renewalDate, 'Policy should have a renewal date');
    });

    it('should store quotation snapshot', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.ok(policy.quotationSnapshot, 'Should have quotation snapshot');
      assert.strictEqual(policy.quotationSnapshot.referenceId, 'QUOT-2024-001', 'Should store quotation reference');
    });

    it('should store lead snapshot from quotation', async () => {
      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);

      assert.ok(policy.leadSnapshot, 'Should have lead snapshot');
      assert.strictEqual(policy.leadSnapshot.firstName, 'John', 'Should store lead first name');
    });

    it('should reject when quotation cannot be fetched', async () => {
      // Create a new implementation that throws error
      axiosGetStub.mock.mockImplementationOnce(async () => {
        throw new Error('Network error');
      });

      const params = {
        quotationId: 'invalid-quot',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      await assert.rejects(
        () => policyIssuanceService.issuePolicy(params),
        { message: /Could not fetch quotation/ },
        'Should reject when quotation fetch fails'
      );
    });

    it('should reject when plan is not found in quotation', async () => {
      // Mock to return plans array without the requested plan
      axiosGetStub.mock.mockImplementationOnce(async (url: string) => {
        if (url.includes('/plans')) {
          return {
            data: {
              success: true,
              data: [{ ...mockPlan, id: 'different-plan', planId: 'different-plan' }],
            },
          };
        }
        return {
          data: {
            success: true,
            data: mockQuotation,
          },
        };
      });

      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'non-existent-plan',
      };

      await assert.rejects(
        () => policyIssuanceService.issuePolicy(params),
        { message: /Plan.*not found/ },
        'Should reject when plan is not found'
      );
    });
  });

  describe('generatePolicyNumber', () => {
    it('should generate policy numbers in correct format', async () => {
      // Ensure mock is set up properly for this test
      axiosGetStub.mock.mockImplementation(async (url: string) => {
        if (url.includes('/plans')) {
          return {
            data: {
              success: true,
              data: [mockPlan],
            },
          };
        }
        return {
          data: {
            success: true,
            data: mockQuotation,
          },
        };
      });

      const params = {
        quotationId: 'quot-123',
        leadId: 'lead-123',
        customerId: 'customer-123',
        selectedPlanId: 'plan-123',
      };

      const policy = await policyIssuanceService.issuePolicy(params);
      const currentYear = new Date().getFullYear();
      
      assert.ok(policy.policyNumber.match(/^POL-\d{4}-\d{6}$/), 'Policy number should match format POL-YYYY-NNNNNN');
      assert.ok(policy.policyNumber.includes(`POL-${currentYear}-`), 'Policy number should include current year');
    });
  });

  describe('getPolicyDates', () => {
    it('should return correct policy dates with default start date', () => {
      const result = policyIssuanceService.getPolicyDates();
      
      assert.ok(result.effectiveDate, 'Should have effective date');
      assert.ok(result.expiryDate, 'Should have expiry date');
      
      const daysDiff = Math.floor((result.expiryDate.getTime() - result.effectiveDate.getTime()) / (1000 * 60 * 60 * 24));
      assert.ok(daysDiff >= 364 && daysDiff <= 366, 'Policy should be valid for approximately 1 year');
    });

    it('should return correct policy dates with custom start date', () => {
      const customStartDate = new Date('2024-06-01');
      const result = policyIssuanceService.getPolicyDates(customStartDate);
      
      assert.strictEqual(result.effectiveDate.toDateString(), customStartDate.toDateString(), 'Should use custom start date');
      
      const expectedExpiryYear = customStartDate.getFullYear() + 1;
      assert.strictEqual(result.expiryDate.getFullYear(), expectedExpiryYear, 'Expiry should be 1 year after start');
    });
  });

  describe('validateQuotation', () => {
    it('should return true for valid quotation (placeholder implementation)', async () => {
      const result = await policyIssuanceService.validateQuotation('quot-123');
      
      assert.strictEqual(result, true, 'Should return true (placeholder)');
    });
  });
});

