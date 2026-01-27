/**
 * Request Revision API Tests
 * Tests for the customer-facing request revision endpoint
 */

import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { requestRevision } from './requestRevision';
import type { HttpRequest, InvocationContext } from '@azure/functions';

// Mock dependencies
const mockCosmosService = {
  getQuotationByToken: mock.fn(),
  updateQuotation: mock.fn(),
};

const mockEventGridService = {
  publishEvent: mock.fn(),
};

const mockTokenService = {
  isValidTokenFormat: mock.fn(() => true),
  isTokenUsed: mock.fn(() => false),
};

// Mock modules
mock.module('../../services/cosmosService', () => ({
  cosmosService: mockCosmosService,
}));

mock.module('../../services/eventGridService', () => ({
  eventGridService: mockEventGridService,
}));

mock.module('../../services/tokenService', () => ({
  tokenService: mockTokenService,
}));

describe('Request Revision API', () => {
  beforeEach(() => {
    mockCosmosService.getQuotationByToken.mock.resetCalls();
    mockCosmosService.updateQuotation.mock.resetCalls();
    mockEventGridService.publishEvent.mock.resetCalls();
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

    const response = await requestRevision(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 400);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Token is required'));
  });

  it('should return 400 if token format is invalid', async () => {
    mockTokenService.isValidTokenFormat.mock.mockImplementation(() => false);

    const request = {
      params: { token: 'invalid-token' },
      json: async () => ({}),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await requestRevision(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 400);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('Invalid token format'));
  });

  it('should return 404 if quotation not found', async () => {
    mockCosmosService.getQuotationByToken.mock.mockImplementation(() => Promise.resolve(null));

    const request = {
      params: { token: 'valid-token-123' },
      json: async () => ({}),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await requestRevision(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 404);
    assert.strictEqual(body.success, false);
    assert.ok(body.error.includes('not found'));
  });

  it('should return 410 if token already used', async () => {
    const mockQuotation = {
      id: 'quotation-1',
      leadId: 'lead-1',
      token: 'valid-token-123',
      tokenUsedAt: new Date(),
      validUntil: new Date(Date.now() + 86400000),
    };

    mockCosmosService.getQuotationByToken.mock.mockImplementation(() => Promise.resolve(mockQuotation));
    mockTokenService.isTokenUsed.mock.mockImplementation(() => true);

    const request = {
      params: { token: 'valid-token-123' },
      json: async () => ({}),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await requestRevision(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 410);
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.used, true);
  });

  it('should successfully process revision request', async () => {
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

    const request = {
      params: { token: 'valid-token-123' },
      json: async () => ({ reason: 'Need different coverage' }),
    } as unknown as HttpRequest;

    const context = {
      log: () => {},
      warn: () => {},
      error: () => {},
    } as unknown as InvocationContext;

    const response = await requestRevision(request, context);
    const body = await (response as any).jsonBody;

    assert.strictEqual((response as any).status, 200);
    assert.strictEqual(body.success, true);
    assert.ok(mockCosmosService.updateQuotation.mock.calls.length > 0);
    assert.ok(mockEventGridService.publishEvent.mock.calls.length > 0);
    
    // Verify updateQuotation was called with correct status
    const updateCall = mockCosmosService.updateQuotation.mock.calls[0];
    assert.strictEqual(updateCall.arguments[2].status, 'revision_requested');
    assert.ok(updateCall.arguments[2].revisionReason);
  });
});

