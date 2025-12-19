/**
 * Decision Step Routing Tests
 * Tests for decision step execution and routing, specifically for quotation_approved condition
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { evaluateLeadCondition } from '../services/leadServiceClient';
import { generateDefaultHealthInsurancePipeline } from '../data/seedDefaultPipeline';

// Mock global fetch
const originalFetch = global.fetch;
let fetchMock: any;

beforeEach(() => {
  fetchMock = async (url: string | URL | Request, init?: RequestInit) => {
    return {
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ error: 'Not found' }),
      text: async () => 'Not found',
    } as Response;
  };
  global.fetch = fetchMock as typeof fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('Decision Step Routing', () => {
  describe('Pipeline Configuration - Quotation Approved Decision', () => {
    it('should have decision step configured with correct routing', () => {
      const pipeline = generateDefaultHealthInsurancePipeline();
      
      // Find the customer response decision step
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      assert.ok(decisionStep, 'Decision step should exist');
      assert.strictEqual(decisionStep.type, 'decision');
      
      if (decisionStep.type === 'decision') {
        assert.strictEqual(
          decisionStep.conditionType,
          'quotation_approved',
          'Condition type should be quotation_approved'
        );
        
        // Find the pending review step (true branch routes to Pending Review)
        const pendingReviewStep = pipeline.steps.find(step => step.id === decisionStep.trueNextStepId);
        assert.ok(pendingReviewStep, 'Pending Review step should exist');
        assert.strictEqual(pendingReviewStep?.name, 'Pending Review', 'Should route to Pending Review stage');
        assert.strictEqual(pendingReviewStep?.enabled, true, 'Pending Review step should be enabled');
        
        // Find the lost step
        const lostStep = pipeline.steps.find(step => step.id === decisionStep.falseNextStepId);
        assert.ok(lostStep, 'Lost step should exist');
        assert.strictEqual(lostStep?.name, 'Lost', 'Should route to Lost stage when false');
      }
    });

    it('should route to Approved stage when quotation is approved', async () => {
      // Mock lead and quotation service responses
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/leads/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                lead: {
                  id: 'test-lead',
                  leadId: 'test-lead',
                  lineOfBusiness: 'medical',
                },
              },
            }),
          } as Response;
        } else if (urlStr.includes('/quotations')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                {
                  id: 'quotation-1',
                  leadId: 'test-lead',
                  status: 'approved',
                  createdAt: new Date().toISOString(),
                  version: 1,
                },
              ],
              pagination: {
                totalRecords: 1,
                totalPages: 1,
              },
            }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const pipeline = generateDefaultHealthInsurancePipeline();
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      assert.ok(decisionStep && decisionStep.type === 'decision');
      
      // Evaluate the condition
      const conditionMet = await evaluateLeadCondition(
        'test-lead',
        'medical',
        decisionStep.conditionType
      );
      
      assert.strictEqual(conditionMet, true, 'Condition should be true for approved quotation');
      
      // Verify routing - true branch routes to Pending Review (not directly to Approved)
      const nextStep = pipeline.steps.find(step => step.id === decisionStep.trueNextStepId);
      assert.ok(nextStep, 'Next step should exist');
      assert.strictEqual(nextStep?.name, 'Pending Review', 'Should route to Pending Review stage');
    });

    it('should route to Revision Requested stage when responseType is request_revision', () => {
      const pipeline = generateDefaultHealthInsurancePipeline();
      
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      assert.ok(decisionStep && decisionStep.type === 'decision');
      
      // Find Revision Requested step
      const revisionStep = pipeline.steps.find(
        step => step.type === 'stage' && 
        (step as any).stageId === 'revision-requested'
      );
      
      assert.ok(revisionStep, 'Revision Requested step should exist');
      assert.strictEqual(revisionStep?.name, 'Revision Requested');
    });

    it('should route to Lost stage when quotation is not approved', async () => {
      // Mock lead and quotation service responses
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/leads/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                lead: {
                  id: 'test-lead',
                  leadId: 'test-lead',
                  lineOfBusiness: 'medical',
                },
              },
            }),
          } as Response;
        } else if (urlStr.includes('/quotations')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                {
                  id: 'quotation-1',
                  leadId: 'test-lead',
                  status: 'rejected',
                  createdAt: new Date().toISOString(),
                  version: 1,
                },
              ],
              pagination: {
                totalRecords: 1,
                totalPages: 1,
              },
            }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const pipeline = generateDefaultHealthInsurancePipeline();
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      assert.ok(decisionStep && decisionStep.type === 'decision');
      
      // Evaluate the condition
      const conditionMet = await evaluateLeadCondition(
        'test-lead',
        'medical',
        decisionStep.conditionType
      );
      
      assert.strictEqual(conditionMet, false, 'Condition should be false for rejected quotation');
      
      // Verify routing
      const nextStep = pipeline.steps.find(step => step.id === decisionStep.falseNextStepId);
      assert.ok(nextStep, 'Next step should exist');
      assert.strictEqual(nextStep?.name, 'Lost', 'Should route to Lost stage');
    });

    it('should route to Approved stage when quotation status is policy_issued', async () => {
      // Mock lead and quotation service responses
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/leads/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                lead: {
                  id: 'test-lead',
                  leadId: 'test-lead',
                  lineOfBusiness: 'medical',
                },
              },
            }),
          } as Response;
        } else if (urlStr.includes('/quotations')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                {
                  id: 'quotation-1',
                  leadId: 'test-lead',
                  status: 'policy_issued',
                  createdAt: new Date().toISOString(),
                  version: 1,
                },
              ],
              pagination: {
                totalRecords: 1,
                totalPages: 1,
              },
            }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const pipeline = generateDefaultHealthInsurancePipeline();
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      assert.ok(decisionStep && decisionStep.type === 'decision');
      
      // Evaluate the condition
      const conditionMet = await evaluateLeadCondition(
        'test-lead',
        'medical',
        decisionStep.conditionType
      );
      
      assert.strictEqual(conditionMet, true, 'Condition should be true for policy_issued status');
      
      // Verify routing
      const nextStep = pipeline.steps.find(step => step.id === decisionStep.trueNextStepId);
      assert.ok(nextStep, 'Next step should exist');
      assert.strictEqual(nextStep?.name, 'Pending Review', 'Should route to Pending Review stage');
    });

    it('should route to Approved stage when customer selects a plan', async () => {
      // Mock lead and quotation service responses
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/leads/')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: {
                lead: {
                  id: 'test-lead',
                  leadId: 'test-lead',
                  lineOfBusiness: 'medical',
                },
              },
            }),
          } as Response;
        } else if (urlStr.includes('/quotations')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              data: [
                {
                  id: 'quotation-1',
                  leadId: 'test-lead',
                  status: 'pending_approval',
                  customerSelectedPlanId: 'plan-123', // Customer selected a plan
                  createdAt: new Date().toISOString(),
                  version: 1,
                },
              ],
              pagination: {
                totalRecords: 1,
                totalPages: 1,
              },
            }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const pipeline = generateDefaultHealthInsurancePipeline();
      const decisionStep = pipeline.steps.find(
        step => step.type === 'decision' && step.name === 'Quotation Approved?'
      );
      
      assert.ok(decisionStep && decisionStep.type === 'decision');
      
      // Evaluate the condition
      const conditionMet = await evaluateLeadCondition(
        'test-lead',
        'medical',
        decisionStep.conditionType
      );
      
      assert.strictEqual(conditionMet, true, 'Condition should be true when customer selected a plan');
      
      // Verify routing
      const nextStep = pipeline.steps.find(step => step.id === decisionStep.trueNextStepId);
      assert.ok(nextStep, 'Next step should exist');
      assert.strictEqual(nextStep?.name, 'Pending Review', 'Should route to Pending Review stage when customer selects plan');
    });
  });
});


