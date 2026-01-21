/**
 * Unit Tests: Quotation Service - List Quotations Filtering
 * Tests for status and lineOfBusiness filtering
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { CosmosClient } from '@azure/cosmos';

// Mock Cosmos client setup
const mockCosmosEndpoint = process.env.COSMOS_ENDPOINT || 'https://localhost:8081';
const mockCosmosKey = process.env.COSMOS_KEY || 'mock-key';
const mockDatabaseName = process.env.COSMOS_DATABASE_NAME || 'NectariaDB';

describe('Quotation Service - List Quotations Filtering', () => {
  let cosmosClient: CosmosClient;
  let quotationsContainer: any;
  const testQuotationIds: string[] = [];

  before(async () => {
    // Initialize Cosmos client
    cosmosClient = new CosmosClient({
      endpoint: mockCosmosEndpoint,
      key: mockCosmosKey
    });

    const database = cosmosClient.database(mockDatabaseName);
    quotationsContainer = database.container('Quotations');

    // Create test quotations with different statuses and LOBs
    const testQuotations = [
      {
        id: 'quot-test-1',
        referenceId: 'QUOT-TEST-001',
        leadId: 'lead-1',
        lineOfBusiness: 'medical',
        status: 'draft',
        totalPremium: 1000,
        currency: 'AED',
        isCurrentVersion: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'quot-test-2',
        referenceId: 'QUOT-TEST-002',
        leadId: 'lead-2',
        lineOfBusiness: 'medical',
        status: 'pending',
        totalPremium: 2000,
        currency: 'AED',
        isCurrentVersion: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'quot-test-3',
        referenceId: 'QUOT-TEST-003',
        leadId: 'lead-3',
        lineOfBusiness: 'motor',
        status: 'sent',
        totalPremium: 1500,
        currency: 'AED',
        isCurrentVersion: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'quot-test-4',
        referenceId: 'QUOT-TEST-004',
        leadId: 'lead-4',
        lineOfBusiness: 'motor',
        status: 'rejected',
        totalPremium: 3000,
        currency: 'AED',
        isCurrentVersion: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'quot-test-5',
        referenceId: 'QUOT-TEST-005',
        leadId: 'lead-5',
        lineOfBusiness: 'medical',
        status: 'pending_approval',
        totalPremium: 2500,
        currency: 'AED',
        isCurrentVersion: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'quot-test-6',
        referenceId: 'QUOT-TEST-006',
        leadId: 'lead-6',
        lineOfBusiness: 'medical',
        status: 'policy_issued',
        totalPremium: 1800,
        currency: 'AED',
        isCurrentVersion: true,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'quot-test-7',
        referenceId: 'QUOT-TEST-007',
        leadId: 'lead-7',
        lineOfBusiness: 'general',
        status: 'superseded',
        totalPremium: 2200,
        currency: 'AED',
        isCurrentVersion: false,
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Insert test quotations
    for (const quotation of testQuotations) {
      try {
        await quotationsContainer.items.create(quotation);
        testQuotationIds.push(quotation.id);
      } catch (error: any) {
        if (error.code !== 409) { // Ignore if already exists
          throw error;
        }
      }
    }
  });

  after(async () => {
    // Cleanup test quotations
    for (const quotId of testQuotationIds) {
      try {
        await quotationsContainer.item(quotId, quotId.replace('quot-test-', 'lead-')).delete();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  it('should filter by single status', async () => {
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status)`,
      parameters: [
        { name: '@statuses', value: ['draft'] }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(filteredQuotations.length >= 1, 'Should return at least 1 quotation with "draft" status');
    assert.ok(
      filteredQuotations.every((q: any) => q.status === 'draft'),
      'All returned quotations should have "draft" status'
    );
  });

  it('should filter by multiple statuses', async () => {
    const allowedStatuses = ['draft', 'pending', 'sent', 'rejected', 'superseded'];
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status)`,
      parameters: [
        { name: '@statuses', value: allowedStatuses }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(filteredQuotations.length >= 5, 'Should return at least 5 quotations with allowed statuses');
    assert.ok(
      filteredQuotations.every((q: any) => allowedStatuses.includes(q.status)),
      'All returned quotations should have allowed statuses'
    );
    assert.ok(
      !filteredQuotations.some((q: any) => ['pending_approval', 'policy_issued'].includes(q.status)),
      'Should not include pending_approval or policy_issued statuses'
    );
  });

  it('should filter by lineOfBusiness', async () => {
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@lobs, c.lineOfBusiness)`,
      parameters: [
        { name: '@lobs', value: ['medical'] }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(filteredQuotations.length >= 4, 'Should return at least 4 medical quotations');
    assert.ok(
      filteredQuotations.every((q: any) => q.lineOfBusiness === 'medical'),
      'All returned quotations should be medical LOB'
    );
  });

  it('should filter by multiple lineOfBusiness values', async () => {
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@lobs, c.lineOfBusiness)`,
      parameters: [
        { name: '@lobs', value: ['medical', 'motor'] }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(filteredQuotations.length >= 6, 'Should return at least 6 quotations');
    assert.ok(
      filteredQuotations.every((q: any) => ['medical', 'motor'].includes(q.lineOfBusiness)),
      'All quotations should be medical or motor'
    );
    assert.ok(
      !filteredQuotations.some((q: any) => q.lineOfBusiness === 'general'),
      'Should not include general LOB'
    );
  });

  it('should combine status and lineOfBusiness filters', async () => {
    const allowedStatuses = ['draft', 'pending', 'sent'];
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status) AND ARRAY_CONTAINS(@lobs, c.lineOfBusiness)`,
      parameters: [
        { name: '@statuses', value: allowedStatuses },
        { name: '@lobs', value: ['medical'] }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(filteredQuotations.length >= 2, 'Should return at least 2 quotations');
    assert.ok(
      filteredQuotations.every((q: any) => q.lineOfBusiness === 'medical'),
      'All quotations should be medical'
    );
    assert.ok(
      filteredQuotations.every((q: any) => allowedStatuses.includes(q.status)),
      'All quotations should have allowed statuses'
    );
    assert.ok(
      !filteredQuotations.some((q: any) => q.status === 'pending_approval'),
      'Should not include pending_approval'
    );
  });

  it('should exclude statuses with dedicated pages by default', async () => {
    const activeStatuses = ['draft', 'pending', 'sent', 'viewed', 'revision_requested', 'rejected', 'superseded'];
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status)`,
      parameters: [
        { name: '@statuses', value: activeStatuses }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(
      !filteredQuotations.some((q: any) => q.status === 'pending_approval'),
      'Should not include pending_approval'
    );
    assert.ok(
      !filteredQuotations.some((q: any) => q.status === 'policy_issued'),
      'Should not include policy_issued'
    );
  });

  it('should return empty results when no matches', async () => {
    const query = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status) AND c.lineOfBusiness = @lob`,
      parameters: [
        { name: '@statuses', value: ['draft'] },
        { name: '@lob', value: 'nonexistent-lob' }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();

    assert.strictEqual(resources.length, 0, 'Should return empty array when no matches');
  });

  it('should correctly paginate filtered results', async () => {
    const allowedStatuses = ['draft', 'pending', 'sent', 'rejected'];
    const limit = 2;
    const offset = 0;

    const countQuery = {
      query: `SELECT VALUE COUNT(1) FROM c WHERE ARRAY_CONTAINS(@statuses, c.status)`,
      parameters: [
        { name: '@statuses', value: allowedStatuses }
      ]
    };

    const { resources: countResult } = await quotationsContainer.items.query(countQuery).fetchAll();
    const totalCount = countResult[0] || 0;

    const dataQuery = {
      query: `SELECT * FROM c WHERE ARRAY_CONTAINS(@statuses, c.status) ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${limit}`,
      parameters: [
        { name: '@statuses', value: allowedStatuses }
      ]
    };

    const { resources: quotations } = await quotationsContainer.items.query(dataQuery).fetchAll();

    assert.ok(totalCount >= 4, 'Total count should be at least 4');
    assert.ok(quotations.length <= limit, `Should return at most ${limit} quotations`);
    
    // Verify pagination calculation
    const expectedTotalPages = Math.ceil(totalCount / limit);
    assert.ok(expectedTotalPages >= 2, 'Should have at least 2 pages with limit of 2');
    
    // Verify that with pagination, we get correct number of results
    // For first page with limit 2, we should get exactly 2 quotations (if totalCount >= 2)
    if (totalCount >= limit) {
      assert.strictEqual(quotations.length, limit, `First page should return exactly ${limit} quotations when totalCount >= limit`);
    } else {
      assert.strictEqual(quotations.length, totalCount, 'First page should return all quotations when totalCount < limit');
    }
  });

  it('should filter by isCurrentVersion', async () => {
    const query = {
      query: `SELECT * FROM c WHERE c.isCurrentVersion = @isCurrentVersion`,
      parameters: [
        { name: '@isCurrentVersion', value: true }
      ]
    };

    const { resources } = await quotationsContainer.items.query(query).fetchAll();
    const filteredQuotations = resources.filter((q: any) => testQuotationIds.includes(q.id));

    assert.ok(filteredQuotations.length >= 6, 'Should return at least 6 current version quotations');
    assert.ok(
      filteredQuotations.every((q: any) => q.isCurrentVersion === true),
      'All quotations should be current versions'
    );
  });
});
