/**
 * getComparisonPdf HTTP tests
 * Run with COSMOS_DB_ENDPOINT and COSMOS_DB_KEY set (e.g. dummy values) so cosmosService loads.
 */

import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert';
import { mock } from 'node:test';
import { cosmosService } from '../../services/cosmosService';
import { pdfService } from '../../services/pdfService';
import { getComparisonPdf } from './getComparisonPdf';
import type { HttpRequest, InvocationContext } from '@azure/functions';
import type { Quotation } from '../../models/quotation';
import type { QuotationPlan } from '../../models/quotation';

const mockQuotation: Quotation = {
  id: 'quot-1',
  referenceId: 'QUOT-2024-001',
  leadId: 'lead-1',
  customerId: 'cust-1',
  planIds: ['plan-1'],
  lineOfBusiness: 'medical',
  businessType: 'individual',
  totalPremium: 5000,
  currency: 'AED',
  validUntil: new Date('2025-12-31'),
  termsAndConditions: '',
  status: 'draft',
  isCurrentVersion: true,
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPlans: QuotationPlan[] = [
  {
    id: 'plan-1',
    quotationId: 'quot-1',
    planId: 'plan-1',
    leadId: 'lead-1',
    vendorId: 'v1',
    vendorName: 'ABC Insurance',
    vendorCode: 'ABC',
    planName: 'Premium Plan',
    planCode: 'P1',
    planType: 'comprehensive',
    annualPremium: 5000,
    monthlyPremium: 416.67,
    currency: 'AED',
    annualLimit: 500000,
    deductible: 500,
    coInsurance: 20,
    waitingPeriod: 30,
    fullPlanData: {},
    isSelected: false,
    createdAt: new Date(),
  },
];

function createRequest(params: { id?: string }, query: { leadId?: string }): HttpRequest {
  return {
    method: 'GET',
    url: 'http://localhost/api/quotations/quot-1/comparison-pdf?leadId=lead-1',
    headers: new Headers(),
    query: new URLSearchParams(query as any),
    params: params as any,
    user: null,
    body: undefined,
    rawBody: undefined,
  } as unknown as HttpRequest;
}

function createContext(): InvocationContext {
  return {
    log: () => {},
    warn: () => {},
    error: () => {},
    invocationId: 'test',
    functionName: 'getComparisonPdf',
    extraInputs: new Map(),
    extraOutputs: new Map(),
    options: {},
    triggerMetadata: {},
  } as unknown as InvocationContext;
}

describe('getComparisonPdf', () => {
  let cosmosGetById: ReturnType<typeof mock.fn>;
  let cosmosGetPlans: ReturnType<typeof mock.fn>;
  let pdfGenerate: ReturnType<typeof mock.fn>;

  before(() => {
    cosmosGetById = mock.fn(async () => mockQuotation);
    cosmosGetPlans = mock.fn(async () => mockPlans);
    pdfGenerate = mock.fn(async () => Buffer.from('%PDF-1.4 mock'));
    mock.method(cosmosService, 'getQuotationById', cosmosGetById as any);
    mock.method(cosmosService, 'getQuotationPlans', cosmosGetPlans as any);
    mock.method(pdfService, 'generateComparisonPDF', pdfGenerate as any);
  });

  afterEach(() => {
    cosmosGetById.mock.resetCalls();
    cosmosGetPlans.mock.resetCalls();
    pdfGenerate.mock.resetCalls();
  });

  it('should return 400 when quotation id is missing', async () => {
    const request = createRequest({}, { leadId: 'lead-1' });
    const context = createContext();
    const res = await getComparisonPdf(request, context);
    assert.strictEqual(res.status, 400);
    assert.ok((res as any).jsonBody?.error?.includes('Quotation ID'));
  });

  it('should return 400 when leadId is missing', async () => {
    const request = createRequest({ id: 'quot-1' }, {});
    const context = createContext();
    const res = await getComparisonPdf(request, context);
    assert.strictEqual(res.status, 400);
    assert.ok((res as any).jsonBody?.error?.includes('leadId'));
  });

  it('should return 404 when quotation not found', async () => {
    mock.method(cosmosService, 'getQuotationById', mock.fn(async () => null));
    const request = createRequest({ id: 'quot-1' }, { leadId: 'lead-1' });
    const context = createContext();
    const res = await getComparisonPdf(request, context);
    assert.strictEqual(res.status, 404);
    mock.method(cosmosService, 'getQuotationById', cosmosGetById as any);
  });

  it('should return 404 when no plans', async () => {
    mock.method(cosmosService, 'getQuotationPlans', mock.fn(async () => []));
    const request = createRequest({ id: 'quot-1' }, { leadId: 'lead-1' });
    const context = createContext();
    const res = await getComparisonPdf(request, context);
    assert.strictEqual(res.status, 404);
    mock.method(cosmosService, 'getQuotationPlans', cosmosGetPlans as any);
  });

  it('should return 200 with PDF when quotation and plans exist', async () => {
    const request = createRequest({ id: 'quot-1' }, { leadId: 'lead-1' });
    const context = createContext();
    const res = await getComparisonPdf(request, context);
    assert.strictEqual(res.status, 200);
    assert.strictEqual((res as any).headers?.['Content-Type'], 'application/pdf');
    assert.ok((res as any).headers?.['Content-Disposition']?.includes('attachment'));
    assert.ok((res as any).body instanceof Buffer);
    assert.ok((res as any).body.length > 0);
  });
});
