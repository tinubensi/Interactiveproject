/**
 * Lead Service Client Tests
 * Tests for lead service client functions, including condition evaluation
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { evaluateLeadCondition } from '../services/leadServiceClient';

// Mock global fetch
const originalFetch = global.fetch;
let fetchMock: any;

beforeEach(() => {
  fetchMock = async (url: string | URL | Request, init?: RequestInit) => {
    // Default mock - return 404 for unknown endpoints
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

describe('Lead Service Client', () => {
  describe('evaluateLeadCondition - quotation_approved', () => {
    it('should return true when quotation exists and status is approved', async () => {
      // Mock lead service response
      let callCount = 0;
      fetchMock = async (url: string | URL | Request) => {
        const urlStr = url.toString();
        if (urlStr.includes('/leads/')) {
          // Lead service call
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
          // Quotation service call
          callCount++;
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

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, true, 'Should return true for approved quotation');
      assert.strictEqual(callCount, 1, 'Should call quotation service once');
    });

    it('should return false when quotation exists but status is pending_approval', async () => {
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

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, false, 'Should return false for pending_approval status');
    });

    it('should return true when quotation status is policy_issued', async () => {
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

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, true, 'Should return true for policy_issued status');
    });

    it('should return false when no quotations found', async () => {
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
              data: [],
              pagination: {
                totalRecords: 0,
                totalPages: 0,
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

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, false, 'Should return false when no quotations found');
    });

    it('should return false when quotation service is unavailable', async () => {
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
          // Simulate service unavailable
          throw new Error('Service unavailable');
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, false, 'Should return false when service unavailable (graceful degradation)');
    });

    it('should check most recent quotation when multiple quotations exist', async () => {
      const olderDate = new Date('2024-01-01').toISOString();
      const newerDate = new Date('2024-12-01').toISOString();

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
                  createdAt: olderDate,
                  version: 1,
                },
                {
                  id: 'quotation-2',
                  leadId: 'test-lead',
                  status: 'approved',
                  createdAt: newerDate,
                  version: 2,
                },
              ],
              pagination: {
                totalRecords: 2,
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

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      // Should check the most recent quotation (version 2, approved)
      assert.strictEqual(result, true, 'Should return true based on most recent quotation');
    });

    it('should return false when quotation service returns error status', async () => {
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
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Internal server error' }),
          } as Response;
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, false, 'Should return false when quotation service returns error');
    });

    it('should return true when customer has selected a plan (pending_approval status)', async () => {
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

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, true, 'Should return true when customer has selected a plan');
    });

    it('should return true immediately when event data indicates plan_selected (avoids race condition)', async () => {
      // Mock lead service response
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
        }
        // Should NOT call quotation service when event data is present
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      const eventData = {
        responseType: 'plan_selected',
        selectedPlanId: 'plan-123',
        quotationId: 'quotation-1',
      };

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved',
        undefined,
        eventData
      );

      assert.strictEqual(result, true, 'Should return true immediately when event data has plan_selected');
    });

    it('should return true when quotation.pending_approval event has selectedPlanId (without responseType)', async () => {
      // Mock lead service response
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
        }
        // Should NOT call quotation service when event data is present
        return {
          ok: false,
          status: 404,
          json: async () => ({}),
        } as Response;
      };
      global.fetch = fetchMock as typeof fetch;

      // quotation.pending_approval event has selectedPlanId but no responseType
      const eventData = {
        selectedPlanId: 'plan-123',
        quotationId: 'quotation-1',
        // No responseType field
      };

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved',
        undefined,
        eventData
      );

      assert.strictEqual(result, true, 'Should return true when quotation.pending_approval event has selectedPlanId');
    });

    it('should return false when event data has responseType but no selectedPlanId', async () => {
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
          // Should fall back to API call
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

      const eventData = {
        responseType: 'plan_selected',
        // No selectedPlanId
      };

      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved',
        undefined,
        eventData
      );

      assert.strictEqual(result, false, 'Should return false when event data missing selectedPlanId');
    });

    it('should fall back to API call when event data is not provided', async () => {
      let apiCallCount = 0;
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
          apiCallCount++;
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

      // No event data provided
      const result = await evaluateLeadCondition(
        'test-lead',
        'medical',
        'quotation_approved'
      );

      assert.strictEqual(result, true, 'Should return true from API call');
      assert.strictEqual(apiCallCount, 1, 'Should call quotation service when event data not provided');
    });
  });
});


