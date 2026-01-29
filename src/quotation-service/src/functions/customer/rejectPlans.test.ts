/**
 * Reject Plans API Tests
 * Tests for the customer-facing reject plans endpoint
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { rejectPlans } from './rejectPlans';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// Mock dependencies
const mockCosmosService = {
  getQuotationByToken: mock.fn(),
  updateQuotation: mock.fn(),
};

const mockEventGridService = {
  publishEvent: mock.fn(),
  publishQuotationRejected: mock.fn(),
};

const mockTokenService = {
  isValidTokenFormat: mock.fn(() => true),
  isTokenUsed: mock.fn(() => false),
};

// Mock modules - using function syntax for Node.js test mocks
mock.module('../../services/cosmosService', () => {
  return { cosmosService: mockCosmosService };
});

mock.module('../../services/eventGridService', () => {
  return { eventGridService: mockEventGridService };
});

mock.module('../../services/tokenService', () => {
  return { tokenService: mockTokenService };
});

describe('Reject Plans API', () => {
  beforeEach(() => {
    mockCosmosService.getQuotationByToken.mock.resetCalls();
    mockCosmosService.updateQuotation.mock.resetCalls();
    mockEventGridService.publishEvent.mock.resetCalls();
    mockEventGridService.publishQuotationRejected.mock.resetCalls();
    mockTokenService.isValidTokenFormat.mock.resetCalls();
    mockTokenService.isTokenUsed.mock.resetCalls();
  });

  it('should return 400 if token is missing', async () => {
    const request = {
      params: {},
      json: async () => ({}),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await rejectPlans(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 400);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Token is required'));
  });

  it('should return 404 if quotation not found', async () => {
    (mockCosmosService.getQuotationByToken as any).mockImplementation(async () => null);

    const request = {
      params: { token: 'valid-token-123' },
      json: async () => ({}),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await rejectPlans(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 404);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('not found'));
  });

  it('should successfully process plan rejection', async () => {
    const mockQuotation = {
      id: 'quotation-1',
      leadId: 'lead-1',
      referenceId: 'QUOT-2025-001',
      token: 'valid-token-123',
      tokenUsedAt: null,
      validUntil: new Date(Date.now() + 86400000),
      lineOfBusiness: 'medical',
      businessType: 'individual',
      customerId: 'customer-1',
    };

    mockCosmosService.getQuotationByToken.mock.mockImplementation(() => Promise.resolve(mockQuotation));
    mockCosmosService.updateQuotation.mock.mockImplementation(() => Promise.resolve());
    mockEventGridService.publishEvent.mock.mockImplementation(() => Promise.resolve());
    mockEventGridService.publishQuotationRejected.mock.mockImplementation(() => Promise.resolve());

    const request = {
      params: { token: 'valid-token-123' },
      json: async () => ({ reason: 'Plans not suitable' }),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await rejectPlans(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(mockCosmosService.updateQuotation.mock.calls.length > 0);
    assert.ok(mockEventGridService.publishEvent.mock.calls.length > 0);
    assert.ok(mockEventGridService.publishQuotationRejected.mock.calls.length > 0);
    
    // Verify updateQuotation was called with correct status and timestamp
    const updateCall = mockCosmosService.updateQuotation.mock.calls[0];
    assert.strictEqual(updateCall.arguments[2].status, 'rejected');
    assert.ok(updateCall.arguments[2].rejectionReason);
    assert.ok(updateCall.arguments[2].rejectedAt, 'rejectedAt timestamp should be set');
    assert.ok(updateCall.arguments[2].tokenUsedAt, 'tokenUsedAt timestamp should be set');
    
    // Verify customer.responded event was published with correct responseType
    const customerRespondedCall = mockEventGridService.publishEvent.mock.calls.find(
      call => call.arguments[0] === 'customer.responded'
    );
    assert.ok(customerRespondedCall, 'customer.responded event should be published');
    assert.strictEqual(customerRespondedCall.arguments[2].responseType, 'reject_plans');
    assert.ok(customerRespondedCall.arguments[2].rejectedAt, 'Event should include rejectedAt timestamp');
    
    // Verify quotation.rejected event was published
    const rejectedEventCall = mockEventGridService.publishQuotationRejected.mock.calls[0];
    assert.ok(rejectedEventCall, 'publishQuotationRejected should be called');
    assert.strictEqual(rejectedEventCall.arguments[0].quotationId, 'quotation-1');
    assert.strictEqual(rejectedEventCall.arguments[0].leadId, 'lead-1');
    assert.strictEqual(rejectedEventCall.arguments[0].reason, 'Plans not suitable');
  });
});

