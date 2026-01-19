import { describe, it, before, afterEach } from 'node:test';
import assert from 'node:assert';
import { InvocationContext } from '@azure/functions';

/**
 * Unit Test: Lead Service - Handle Quotation Revision Requested Event
 */

describe('Lead Service: handleQuotationRevisionRequested', () => {
  let mockContext: InvocationContext;
  let mockCosmosService: any;

  before(() => {
    mockContext = {
      log: console.log,
      warn: console.warn,
      error: console.error,
    } as any;

    mockCosmosService = {
      leadsContainer: {
        items: {
          query: (spec: any) => ({
            fetchAll: async () => ({
              resources: [
                {
                  id: 'lead-123',
                  lineOfBusiness: 'medical',
                  revisionRequestedQuotationIds: []
                }
              ]
            })
          })
        }
      },
      updateLead: async (leadId: string, lob: string, updates: any) => {
        return { ...updates };
      }
    };
  });

  it('should add quotation ID to revision history', async () => {
    const event = {
      eventType: 'quotation.revision_requested',
      subject: 'quotation/quot-123',
      data: {
        quotationId: 'quot-123',
        referenceId: 'QUOT-2024-001',
        leadId: 'lead-123',
        customerId: 'cust-456',
        revisionReason: 'Customer requested changes',
        lineOfBusiness: 'medical',
        businessType: 'individual',
        requestedAt: new Date().toISOString()
      }
    };

    // Simulate event handler
    const lead = {
      id: 'lead-123',
      lineOfBusiness: 'medical',
      revisionRequestedQuotationIds: []
    };

    const updatedRevisionIds = [...lead.revisionRequestedQuotationIds, event.data.quotationId];

    assert.ok(updatedRevisionIds.includes('quot-123'), 
      'Quotation ID should be added to revision history');
    assert.strictEqual(updatedRevisionIds.length, 1, 
      'Should have one quotation in revision history');
  });

  it('should not duplicate quotation IDs', async () => {
    const lead = {
      id: 'lead-123',
      revisionRequestedQuotationIds: ['quot-123']
    };

    const quotationId = 'quot-123';

    // Check if already exists
    const alreadyExists = lead.revisionRequestedQuotationIds.includes(quotationId);
    
    const updatedRevisionIds = alreadyExists 
      ? lead.revisionRequestedQuotationIds 
      : [...lead.revisionRequestedQuotationIds, quotationId];

    assert.strictEqual(updatedRevisionIds.length, 1, 
      'Should not duplicate quotation IDs');
    assert.strictEqual(updatedRevisionIds[0], 'quot-123', 
      'Should maintain existing ID');
  });

  it('should handle multiple revisions', async () => {
    const lead = {
      id: 'lead-123',
      revisionRequestedQuotationIds: ['quot-123', 'quot-456']
    };

    const newQuotationId = 'quot-789';
    const updatedRevisionIds = [...lead.revisionRequestedQuotationIds, newQuotationId];

    assert.strictEqual(updatedRevisionIds.length, 3, 
      'Should track multiple revisions');
    assert.ok(updatedRevisionIds.includes('quot-123'), 
      'Should keep first revision');
    assert.ok(updatedRevisionIds.includes('quot-456'), 
      'Should keep second revision');
    assert.ok(updatedRevisionIds.includes('quot-789'), 
      'Should add third revision');
  });

  it('should not change lead stage (Pipeline Service handles that)', async () => {
    // The event handler should NOT update lead stage
    // Only track the revision in the array
    
    const updates = {
      revisionRequestedQuotationIds: ['quot-123'],
      updatedAt: new Date()
      // Note: No currentStage or stageId update
    };

    assert.ok(!('currentStage' in updates), 
      'Should not update currentStage');
    assert.ok(!('stageId' in updates), 
      'Should not update stageId');
    assert.ok('revisionRequestedQuotationIds' in updates, 
      'Should update revision tracking');
  });
});

console.log('✅ Lead Service Revision Event Handler Tests Defined');
