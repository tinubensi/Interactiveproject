/**
 * Unit Tests: Lead Service - List Leads Filtering
 * Tests for currentStage filtering and quotationId exclusion
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { CosmosClient } from '@azure/cosmos';

// Mock Cosmos client setup
const mockCosmosEndpoint = process.env.COSMOS_ENDPOINT || 'https://localhost:8081';
const mockCosmosKey = process.env.COSMOS_KEY || 'mock-key';
const mockDatabaseName = process.env.COSMOS_DATABASE_NAME || 'NectariaDB';

describe('Lead Service - List Leads Filtering', () => {
  let cosmosClient: CosmosClient;
  let leadsContainer: any;
  const testLeadIds: string[] = [];

  before(async () => {
    // Initialize Cosmos client
    cosmosClient = new CosmosClient({
      endpoint: mockCosmosEndpoint,
      key: mockCosmosKey
    });

    const database = cosmosClient.database(mockDatabaseName);
    leadsContainer = database.container('Leads');

    // Create test leads with different stages
    const testLeads = [
      {
        id: 'lead-test-1',
        type: 'lead',
        referenceId: 'LEAD-TEST-001',
        lineOfBusiness: 'medical',
        currentStage: 'Lead Created',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        phone: { countryCode: '+971', number: '501234567' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'lead-test-2',
        type: 'lead',
        referenceId: 'LEAD-TEST-002',
        lineOfBusiness: 'medical',
        currentStage: 'Plans Fetching',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane.smith@test.com',
        phone: { countryCode: '+971', number: '507654321' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'lead-test-3',
        type: 'lead',
        referenceId: 'LEAD-TEST-003',
        lineOfBusiness: 'medical',
        currentStage: 'Plans Available',
        firstName: 'Bob',
        lastName: 'Johnson',
        email: 'bob.johnson@test.com',
        phone: { countryCode: '+971', number: '509876543' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'lead-test-4',
        type: 'lead',
        referenceId: 'LEAD-TEST-004',
        lineOfBusiness: 'medical',
        currentStage: 'Revision Requested',
        firstName: 'Alice',
        lastName: 'Williams',
        email: 'alice.williams@test.com',
        phone: { countryCode: '+971', number: '501122334' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'lead-test-5',
        type: 'lead',
        referenceId: 'LEAD-TEST-005',
        lineOfBusiness: 'medical',
        currentStage: 'Quotation Created',
        firstName: 'Charlie',
        lastName: 'Brown',
        email: 'charlie.brown@test.com',
        phone: { countryCode: '+971', number: '505566778' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'lead-test-6',
        type: 'lead',
        referenceId: 'LEAD-TEST-006',
        lineOfBusiness: 'medical',
        currentStage: 'Plans Available',
        quotationId: 'quot-123', // Has quotation - should be excluded
        firstName: 'David',
        lastName: 'Miller',
        email: 'david.miller@test.com',
        phone: { countryCode: '+971', number: '508899001' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    // Insert test leads
    for (const lead of testLeads) {
      try {
        await leadsContainer.items.create(lead);
        testLeadIds.push(lead.id);
      } catch (error: any) {
        if (error.code !== 409) { // Ignore if already exists
          throw error;
        }
      }
    }
  });

  after(async () => {
    // Cleanup test leads
    for (const leadId of testLeadIds) {
      try {
        await leadsContainer.item(leadId, 'medical').delete();
      } catch (error) {
        // Ignore errors during cleanup
      }
    }
  });

  it('should filter by single currentStage', async () => {
    const query = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage)`,
      parameters: [
        { name: '@stages', value: ['Lead Created'] }
      ]
    };

    const { resources } = await leadsContainer.items.query(query).fetchAll();
    const filteredLeads = resources.filter((l: any) => testLeadIds.includes(l.id));

    assert.ok(filteredLeads.length >= 1, 'Should return at least 1 lead with "Lead Created" stage');
    assert.ok(
      filteredLeads.every((l: any) => l.currentStage === 'Lead Created'),
      'All returned leads should have "Lead Created" stage'
    );
  });

  it('should filter by multiple currentStages', async () => {
    const allowedStages = ['Lead Created', 'Plans Fetching', 'Plans Available', 'Revision Requested'];
    const query = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage)`,
      parameters: [
        { name: '@stages', value: allowedStages }
      ]
    };

    const { resources } = await leadsContainer.items.query(query).fetchAll();
    const filteredLeads = resources.filter((l: any) => testLeadIds.includes(l.id));

    assert.ok(filteredLeads.length >= 4, 'Should return at least 4 leads with allowed stages');
    assert.ok(
      filteredLeads.every((l: any) => allowedStages.includes(l.currentStage)),
      'All returned leads should have allowed stages'
    );
    assert.ok(
      !filteredLeads.some((l: any) => l.currentStage === 'Quotation Created'),
      'Should not include leads with "Quotation Created" stage'
    );
  });

  it('should exclude leads with quotationId defined', async () => {
    const query = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND NOT IS_DEFINED(c.quotationId)`,
      parameters: []
    };

    const { resources } = await leadsContainer.items.query(query).fetchAll();
    const filteredLeads = resources.filter((l: any) => testLeadIds.includes(l.id));

    assert.ok(
      !filteredLeads.some((l: any) => l.quotationId),
      'Should not include leads with quotationId defined'
    );
    assert.ok(
      !filteredLeads.some((l: any) => l.id === 'lead-test-6'),
      'Should specifically exclude lead-test-6 which has quotationId'
    );
  });

  it('should combine currentStage filter and quotationId exclusion', async () => {
    const allowedStages = ['Lead Created', 'Plans Fetching', 'Plans Available', 'Revision Requested'];
    const query = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage) AND NOT IS_DEFINED(c.quotationId)`,
      parameters: [
        { name: '@stages', value: allowedStages }
      ]
    };

    const { resources } = await leadsContainer.items.query(query).fetchAll();
    const filteredLeads = resources.filter((l: any) => testLeadIds.includes(l.id));

    assert.ok(filteredLeads.length >= 4, 'Should return at least 4 leads');
    assert.ok(
      filteredLeads.every((l: any) => allowedStages.includes(l.currentStage)),
      'All leads should have allowed stages'
    );
    assert.ok(
      !filteredLeads.some((l: any) => l.quotationId),
      'No leads should have quotationId'
    );
    assert.strictEqual(
      filteredLeads.filter((l: any) => ['lead-test-1', 'lead-test-2', 'lead-test-3', 'lead-test-4'].includes(l.id)).length,
      4,
      'Should return exactly our 4 test leads without quotations'
    );
  });

  it('should combine filters with lineOfBusiness and businessType', async () => {
    const allowedStages = ['Lead Created', 'Plans Fetching', 'Plans Available'];
    const query = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage) AND ARRAY_CONTAINS(@lobs, c.lineOfBusiness) AND NOT IS_DEFINED(c.quotationId)`,
      parameters: [
        { name: '@stages', value: allowedStages },
        { name: '@lobs', value: ['medical'] }
      ]
    };

    const { resources } = await leadsContainer.items.query(query).fetchAll();
    const filteredLeads = resources.filter((l: any) => testLeadIds.includes(l.id));

    assert.ok(filteredLeads.length >= 3, 'Should return at least 3 medical leads');
    assert.ok(
      filteredLeads.every((l: any) => l.lineOfBusiness === 'medical'),
      'All leads should be medical'
    );
    assert.ok(
      filteredLeads.every((l: any) => allowedStages.includes(l.currentStage)),
      'All leads should have allowed stages'
    );
  });

  it('should return empty results when no matches', async () => {
    const query = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage) AND c.lineOfBusiness = @lob`,
      parameters: [
        { name: '@stages', value: ['Lead Created'] },
        { name: '@lob', value: 'nonexistent-lob' }
      ]
    };

    const { resources } = await leadsContainer.items.query(query).fetchAll();

    assert.strictEqual(resources.length, 0, 'Should return empty array when no matches');
  });

  it('should correctly paginate filtered results', async () => {
    const allowedStages = ['Lead Created', 'Plans Fetching', 'Plans Available', 'Revision Requested'];
    const limit = 2;
    const offset = 0;

    const countQuery = {
      query: `SELECT VALUE COUNT(1) FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage) AND NOT IS_DEFINED(c.quotationId)`,
      parameters: [
        { name: '@stages', value: allowedStages }
      ]
    };

    const { resources: countResult } = await leadsContainer.items.query(countQuery).fetchAll();
    const totalCount = countResult[0] || 0;

    const dataQuery = {
      query: `SELECT * FROM c WHERE c.type = "lead" AND NOT IS_DEFINED(c.deletedAt) AND ARRAY_CONTAINS(@stages, c.currentStage) AND NOT IS_DEFINED(c.quotationId) ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${limit}`,
      parameters: [
        { name: '@stages', value: allowedStages }
      ]
    };

    const { resources: leads } = await leadsContainer.items.query(dataQuery).fetchAll();

    assert.ok(totalCount >= 4, 'Total count should be at least 4');
    assert.ok(leads.length <= limit, `Should return at most ${limit} leads`);
    
    // Verify pagination calculation
    const expectedTotalPages = Math.ceil(totalCount / limit);
    assert.ok(expectedTotalPages >= 2, 'Should have at least 2 pages with limit of 2');
    
    // Verify that with pagination, we get correct number of results
    // For first page with limit 2, we should get exactly 2 leads (if totalCount >= 2)
    if (totalCount >= limit) {
      assert.strictEqual(leads.length, limit, `First page should return exactly ${limit} leads when totalCount >= limit`);
    } else {
      assert.strictEqual(leads.length, totalCount, 'First page should return all leads when totalCount < limit');
    }
  });
});
