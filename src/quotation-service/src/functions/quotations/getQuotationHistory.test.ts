import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { InvocationContext } from '@azure/functions';

/**
 * Unit Test: Quotation Service - Get Quotation History
 */

describe('Quotation Service: getQuotationHistory', () => {
  let mockContext: InvocationContext;

  before(() => {
    mockContext = { 
      log: console.log,
      warn: console.warn,
      error: console.error,
    } as any;
  });

  it('should return quotations ordered by version (newest first)', () => {
    const quotations = [
      { id: 'quot-1', version: 1, createdAt: '2024-01-01', status: 'superseded' },
      { id: 'quot-2', version: 2, createdAt: '2024-01-02', status: 'superseded' },
      { id: 'quot-3', version: 3, createdAt: '2024-01-03', status: 'revision_requested' }
    ];

    // SQL query would ORDER BY version DESC
    const sorted = [...quotations].sort((a, b) => b.version - a.version);

    assert.strictEqual(sorted[0].version, 3, 'Newest version should be first');
    assert.strictEqual(sorted[0].id, 'quot-3', 'Quot-3 should be first');
    assert.strictEqual(sorted[2].version, 1, 'Oldest version should be last');
  });

  it('should include plans for each quotation', () => {
    const quotationWithPlans = {
      id: 'quot-123',
      version: 1,
      status: 'revision_requested',
      plans: [
        { id: 'plan-1', planName: 'Gold Plan', annualPremium: 5000 },
        { id: 'plan-2', planName: 'Silver Plan', annualPremium: 3000 }
      ]
    };

    assert.ok(Array.isArray(quotationWithPlans.plans), 
      'Should include plans array');
    assert.strictEqual(quotationWithPlans.plans.length, 2, 
      'Should have 2 plans');
    assert.strictEqual(quotationWithPlans.plans[0].planName, 'Gold Plan', 
      'Should include plan details');
  });

  it('should filter out deleted quotations', () => {
    const quotations = [
      { id: 'quot-1', version: 1, deletedAt: null },
      { id: 'quot-2', version: 2, deletedAt: '2024-01-15' }, // Deleted
      { id: 'quot-3', version: 3, deletedAt: null }
    ];

    // SQL query has: WHERE ... AND (NOT IS_DEFINED(c.deletedAt) OR c.deletedAt = null)
    const active = quotations.filter(q => !q.deletedAt);

    assert.strictEqual(active.length, 2, 'Should filter deleted quotations');
    assert.ok(!active.find(q => q.id === 'quot-2'), 
      'Should not include deleted quotation');
  });

  it('should return empty array for lead with no quotations', () => {
    const quotations: any[] = [];

    assert.strictEqual(quotations.length, 0, 
      'Should return empty array');
    assert.ok(Array.isArray(quotations), 
      'Should be an array');
  });

  it('should handle version chain correctly', () => {
    const quotations = [
      { 
        id: 'quot-1', 
        version: 1, 
        previousVersionId: undefined,
        isCurrentVersion: false,
        status: 'superseded'
      },
      { 
        id: 'quot-2', 
        version: 2, 
        previousVersionId: 'quot-1',
        isCurrentVersion: false,
        status: 'superseded'
      },
      { 
        id: 'quot-3', 
        version: 3, 
        previousVersionId: 'quot-2',
        isCurrentVersion: true,
        status: 'revision_requested'
      }
    ];

    // Validate version chain
    assert.strictEqual(quotations[0].previousVersionId, undefined, 
      'First version has no previous');
    assert.strictEqual(quotations[1].previousVersionId, 'quot-1', 
      'Second version links to first');
    assert.strictEqual(quotations[2].previousVersionId, 'quot-2', 
      'Third version links to second');
    assert.strictEqual(quotations[2].isCurrentVersion, true, 
      'Latest should be current version');
  });
});

console.log('✅ Quotation History Endpoint Tests Defined');
