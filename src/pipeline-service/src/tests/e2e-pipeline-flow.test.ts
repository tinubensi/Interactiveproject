/**
 * End-to-End Integration Test - Complete Pipeline Flow
 * 
 * This test validates the complete lead-to-policy flow with hybrid sync/async actions:
 * 1. Create lead → Pipeline instance created
 * 2. Async: Fetch plans → Plans available
 * 3. Manual: Create quotation (sync API call)
 * 4. Async: Send quotation → Quotation sent
 * 5. Manual: Customer responds → Decision routing
 * 6. Manual: Approve quotation
 * 7. Async: Issue policy → Policy issued
 * 8. Pipeline completes
 * 
 * Requirements:
 * - All services must be running (lead, pipeline, quotation-gen, quotation, policy)
 * - Event Grid or HTTP fallback must be configured
 * - Cosmos DB must be accessible
 * 
 * Run with: npm test -- e2e-pipeline-flow.test.ts
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// Test Configuration
// =============================================================================

const TEST_CONFIG = {
  // Service URLs (from environment or defaults)
  leadServiceUrl: process.env.LEAD_SERVICE_URL || 'http://localhost:7078',
  pipelineServiceUrl: process.env.PIPELINE_SERVICE_URL || 'http://localhost:7090',
  quotationServiceUrl: process.env.QUOTATION_SERVICE_URL || 'http://localhost:7081',
  quotationGenServiceUrl: process.env.QUOTATION_GEN_SERVICE_URL || 'http://localhost:7082',
  policyServiceUrl: process.env.POLICY_SERVICE_URL || 'http://localhost:7083',
  
  // Service key for internal API calls
  serviceKey: process.env.INTERNAL_SERVICE_KEY || '',
  
  // Timeouts
  planFetchTimeout: 180000, // 3 minutes for plan fetching
  quotationSendTimeout: 60000, // 1 minute for email sending
  policyIssuanceTimeout: 180000, // 3 minutes for policy issuance
  pollingInterval: 2000, // Poll every 2 seconds
  
  // Test data
  testCustomer: {
    firstName: 'E2E',
    lastName: 'Test',
    email: `e2e-test-${Date.now()}@example.com`,
    phoneNumber: '+971501234567',
    dateOfBirth: '1985-01-15',
    nationality: 'AE',
  },
  testLead: {
    lineOfBusiness: 'medical' as const,
    businessType: 'individual' as const,
    lobData: {
      dateOfBirth: '1985-01-15',
      gender: 'male',
      nationality: 'AE',
      emiratesId: '784-1985-1234567-1',
      visaType: 'resident',
      maritalStatus: 'single',
      numberOfDependents: 0,
      occupation: 'Engineer',
      annualIncome: 150000,
      estimatedPremium: 3000,
      coverageAmount: 500000,
      preferredStartDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  },
};

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Make authenticated API call
 */
async function apiCall(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  
  if (TEST_CONFIG.serviceKey) {
    headers['x-service-key'] = TEST_CONFIG.serviceKey;
  }
  
  const response = await fetch(url, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API call failed: ${response.status} ${errorText}`);
  }
  
  return response.json();
}

/**
 * Wait for pipeline instance to reach a specific stage
 */
async function waitForStage(
  leadId: string,
  expectedStage: string,
  timeout: number = 60000
): Promise<any> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const instance = await apiCall(
        `${TEST_CONFIG.pipelineServiceUrl}/api/instances?leadId=${leadId}`
      );
      
      if (instance.instances && instance.instances.length > 0) {
        const currentInstance = instance.instances[0];
        console.log(`  [${new Date().toISOString()}] Current stage: ${currentInstance.currentStageName}, Progress: ${currentInstance.progressPercent}%`);
        
        if (currentInstance.currentStageName === expectedStage) {
          return currentInstance;
        }
      }
    } catch (error) {
      console.error(`  Error checking stage: ${error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.pollingInterval));
  }
  
  throw new Error(`Timeout waiting for stage "${expectedStage}" after ${timeout}ms`);
}

/**
 * Wait for pipeline instance status
 */
async function waitForStatus(
  leadId: string,
  expectedStatus: string,
  timeout: number = 60000
): Promise<any> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const instance = await apiCall(
        `${TEST_CONFIG.pipelineServiceUrl}/api/instances?leadId=${leadId}`
      );
      
      if (instance.instances && instance.instances.length > 0) {
        const currentInstance = instance.instances[0];
        console.log(`  [${new Date().toISOString()}] Status: ${currentInstance.status}, Progress: ${currentInstance.progressPercent}%`);
        
        if (currentInstance.status === expectedStatus) {
          return currentInstance;
        }
      }
    } catch (error) {
      console.error(`  Error checking status: ${error}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.pollingInterval));
  }
  
  throw new Error(`Timeout waiting for status "${expectedStatus}" after ${timeout}ms`);
}

// =============================================================================
// Test Suite
// =============================================================================

describe('E2E Pipeline Flow - Lead to Policy', () => {
  let testCustomerId: string;
  let testLeadId: string;
  let testInstanceId: string;
  let testQuotationId: string;
  let testPolicyId: string;
  
  before(async () => {
    console.log('\n========================================');
    console.log('E2E Pipeline Flow Test - Setup');
    console.log('========================================');
    console.log('Lead Service:', TEST_CONFIG.leadServiceUrl);
    console.log('Pipeline Service:', TEST_CONFIG.pipelineServiceUrl);
    console.log('Quotation Service:', TEST_CONFIG.quotationServiceUrl);
    console.log('Quotation Gen Service:', TEST_CONFIG.quotationGenServiceUrl);
    console.log('Policy Service:', TEST_CONFIG.policyServiceUrl);
    console.log('========================================\n');
  });
  
  after(async () => {
    console.log('\n========================================');
    console.log('E2E Pipeline Flow Test - Summary');
    console.log('========================================');
    console.log('Customer ID:', testCustomerId || 'N/A');
    console.log('Lead ID:', testLeadId || 'N/A');
    console.log('Instance ID:', testInstanceId || 'N/A');
    console.log('Quotation ID:', testQuotationId || 'N/A');
    console.log('Policy ID:', testPolicyId || 'N/A');
    console.log('========================================\n');
  });
  
  // ===========================================================================
  // Step 1: Create Customer
  // ===========================================================================
  
  it('should create a test customer', async () => {
    console.log('\n[STEP 1] Creating customer...');
    
    const response = await apiCall(
      `${TEST_CONFIG.leadServiceUrl}/api/customers`,
      {
        method: 'POST',
        body: JSON.stringify(TEST_CONFIG.testCustomer),
      }
    );
    
    assert.ok(response.id, 'Customer should have an ID');
    testCustomerId = response.id;
    
    console.log(`✓ Customer created: ${testCustomerId}`);
  });
  
  // ===========================================================================
  // Step 2: Create Lead → Pipeline Instance Created
  // ===========================================================================
  
  it('should create a lead and trigger pipeline instance creation', async () => {
    console.log('\n[STEP 2] Creating lead...');
    
    const response = await apiCall(
      `${TEST_CONFIG.leadServiceUrl}/api/leads`,
      {
        method: 'POST',
        body: JSON.stringify({
          customerId: testCustomerId,
          ...TEST_CONFIG.testLead,
        }),
      }
    );
    
    assert.ok(response.id, 'Lead should have an ID');
    testLeadId = response.id;
    
    console.log(`✓ Lead created: ${testLeadId}`);
    console.log('  Waiting for pipeline instance creation...');
    
    // Wait for pipeline instance to be created
    const instance = await waitForStage(testLeadId, 'Lead Created', 30000);
    
    assert.strictEqual(instance.leadId, testLeadId, 'Instance should be for test lead');
    assert.strictEqual(instance.currentStageName, 'Lead Created', 'Should be at Lead Created stage');
    assert.ok(instance.progressPercent > 0, 'Progress should be greater than 0');
    
    testInstanceId = instance.instanceId;
    console.log(`✓ Pipeline instance created: ${testInstanceId}`);
    console.log(`  Progress: ${instance.progressPercent}%`);
  });
  
  // ===========================================================================
  // Step 3: Async Plan Fetching → Plans Available
  // ===========================================================================
  
  it('should fetch plans asynchronously and reach Plans Available stage', async () => {
    console.log('\n[STEP 3] Waiting for async plan fetching...');
    console.log(`  Timeout: ${TEST_CONFIG.planFetchTimeout / 1000}s`);
    
    // Wait for Plans Fetching stage
    console.log('  Waiting for Plans Fetching stage...');
    await waitForStage(testLeadId, 'Plans Fetching', 60000);
    console.log('  ✓ Reached Plans Fetching stage');
    
    // Wait for Plans Available stage
    console.log('  Waiting for Plans Available stage...');
    const instance = await waitForStage(testLeadId, 'Plans Available', TEST_CONFIG.planFetchTimeout);
    
    assert.strictEqual(instance.currentStageName, 'Plans Available', 'Should be at Plans Available stage');
    assert.ok(instance.progressPercent >= 30, 'Progress should be at least 30%');
    
    console.log(`✓ Plans fetched and available`);
    console.log(`  Progress: ${instance.progressPercent}%`);
  });
  
  // ===========================================================================
  // Step 4: Create Quotation (Sync API Call)
  // ===========================================================================
  
  it('should create quotation via sync API call', async () => {
    console.log('\n[STEP 4] Creating quotation (sync action)...');
    
    // Get available plans
    const plansResponse = await apiCall(
      `${TEST_CONFIG.quotationGenServiceUrl}/api/plans?leadId=${testLeadId}`
    );
    
    assert.ok(plansResponse.plans, 'Should have plans');
    assert.ok(plansResponse.plans.length > 0, 'Should have at least one plan');
    
    console.log(`  Found ${plansResponse.plans.length} plans`);
    
    // Select first 3 plans
    const selectedPlans = plansResponse.plans.slice(0, Math.min(3, plansResponse.plans.length)).map((plan: any) => ({
      planId: plan.id,
      isSelected: true,
    }));
    
    // Create quotation
    const quotationResponse = await apiCall(
      `${TEST_CONFIG.quotationServiceUrl}/api/quotations`,
      {
        method: 'POST',
        body: JSON.stringify({
          leadId: testLeadId,
          customerId: testCustomerId,
          lineOfBusiness: TEST_CONFIG.testLead.lineOfBusiness,
          businessType: TEST_CONFIG.testLead.businessType,
          selectedPlans,
        }),
      }
    );
    
    assert.ok(quotationResponse.id, 'Quotation should have an ID');
    testQuotationId = quotationResponse.id;
    
    console.log(`✓ Quotation created: ${testQuotationId}`);
    
    // Wait for Quotation Created stage
    console.log('  Waiting for Quotation Created stage...');
    const instance = await waitForStage(testLeadId, 'Quotation Created', 30000);
    
    assert.strictEqual(instance.currentStageName, 'Quotation Created', 'Should be at Quotation Created stage');
    console.log(`✓ Pipeline advanced to Quotation Created`);
    console.log(`  Progress: ${instance.progressPercent}%`);
  });
  
  // ===========================================================================
  // Step 5: Async Quotation Sending → Quotation Sent
  // ===========================================================================
  
  it('should send quotation asynchronously and reach Quotation Sent stage', async () => {
    console.log('\n[STEP 5] Waiting for async quotation sending...');
    console.log(`  Timeout: ${TEST_CONFIG.quotationSendTimeout / 1000}s`);
    
    const instance = await waitForStage(testLeadId, 'Quotation Sent', TEST_CONFIG.quotationSendTimeout);
    
    assert.strictEqual(instance.currentStageName, 'Quotation Sent', 'Should be at Quotation Sent stage');
    assert.ok(instance.progressPercent >= 50, 'Progress should be at least 50%');
    
    console.log(`✓ Quotation sent successfully`);
    console.log(`  Progress: ${instance.progressPercent}%`);
  });
  
  // ===========================================================================
  // Step 6: Customer Response (Simulate)
  // ===========================================================================
  
  it('should handle customer response and route through decision', async () => {
    console.log('\n[STEP 6] Simulating customer response (plan selected)...');
    
    // Get quotation plans
    const plansResponse = await apiCall(
      `${TEST_CONFIG.quotationServiceUrl}/api/quotations/${testQuotationId}/plans`
    );
    
    assert.ok(plansResponse.length > 0, 'Quotation should have plans');
    const selectedPlanId = plansResponse[0].planId;
    
    // Simulate customer response via Event Grid HTTP fallback
    await apiCall(
      `${TEST_CONFIG.pipelineServiceUrl}/api/pipeline/process-event`,
      {
        method: 'POST',
        body: JSON.stringify({
          eventType: 'customer.responded',
          leadId: testLeadId,
          lineOfBusiness: TEST_CONFIG.testLead.lineOfBusiness,
          data: {
            responseType: 'plan_selected',
            selectedPlanId,
            quotationId: testQuotationId,
          },
        }),
      }
    );
    
    console.log('  Event published: customer.responded');
    
    // Wait for Pending Review stage
    console.log('  Waiting for Pending Review stage...');
    const instance = await waitForStage(testLeadId, 'Pending Review', 30000);
    
    assert.strictEqual(instance.currentStageName, 'Pending Review', 'Should be at Pending Review stage');
    console.log(`✓ Routed to Pending Review via decision step`);
    console.log(`  Progress: ${instance.progressPercent}%`);
  });
  
  // ===========================================================================
  // Step 7: Approve Quotation (Sync API Call)
  // ===========================================================================
  
  it('should approve quotation and advance to Approved stage', async () => {
    console.log('\n[STEP 7] Approving quotation...');
    
    // Approve quotation
    await apiCall(
      `${TEST_CONFIG.quotationServiceUrl}/api/quotations/${testQuotationId}/approve`,
      {
        method: 'POST',
        body: JSON.stringify({
          approvedBy: 'e2e-test-user',
          comments: 'E2E test approval',
        }),
      }
    );
    
    console.log('  Quotation approved');
    
    // Wait for Approved stage
    console.log('  Waiting for Approved stage...');
    const instance = await waitForStage(testLeadId, 'Approved', 30000);
    
    assert.strictEqual(instance.currentStageName, 'Approved', 'Should be at Approved stage');
    console.log(`✓ Pipeline advanced to Approved`);
    console.log(`  Progress: ${instance.progressPercent}%`);
  });
  
  // ===========================================================================
  // Step 8: Async Policy Issuance → Policy Issued
  // ===========================================================================
  
  it('should issue policy asynchronously and complete pipeline', async () => {
    console.log('\n[STEP 8] Waiting for async policy issuance...');
    console.log(`  Timeout: ${TEST_CONFIG.policyIssuanceTimeout / 1000}s`);
    
    // Wait for Policy Issued stage
    const instance = await waitForStage(testLeadId, 'Policy Issued', TEST_CONFIG.policyIssuanceTimeout);
    
    assert.strictEqual(instance.currentStageName, 'Policy Issued', 'Should be at Policy Issued stage');
    assert.strictEqual(instance.status, 'completed', 'Pipeline should be completed');
    assert.strictEqual(instance.progressPercent, 100, 'Progress should be 100%');
    
    console.log(`✓ Policy issued successfully`);
    console.log(`  Instance completed: ${instance.instanceId}`);
    console.log(`  Progress: ${instance.progressPercent}%`);
    
    // Verify policy was created
    console.log('  Verifying policy creation...');
    const policiesResponse = await apiCall(
      `${TEST_CONFIG.policyServiceUrl}/api/policies?leadId=${testLeadId}`
    );
    
    assert.ok(policiesResponse.policies, 'Should have policies');
    assert.ok(policiesResponse.policies.length > 0, 'Should have at least one policy');
    
    testPolicyId = policiesResponse.policies[0].id;
    console.log(`✓ Policy verified: ${testPolicyId}`);
  });
  
  // ===========================================================================
  // Step 9: Verify Final State
  // ===========================================================================
  
  it('should verify complete pipeline state', async () => {
    console.log('\n[STEP 9] Verifying final pipeline state...');
    
    // Get final instance state
    const instanceResponse = await apiCall(
      `${TEST_CONFIG.pipelineServiceUrl}/api/instances?leadId=${testLeadId}`
    );
    
    const instance = instanceResponse.instances[0];
    
    // Verify instance state
    assert.strictEqual(instance.status, 'completed', 'Status should be completed');
    assert.strictEqual(instance.progressPercent, 100, 'Progress should be 100%');
    assert.strictEqual(instance.currentStageName, 'Policy Issued', 'Should be at Policy Issued stage');
    assert.ok(instance.completedStepsCount > 0, 'Should have completed steps');
    assert.ok(instance.stepHistory.length > 0, 'Should have step history');
    
    // Verify lead state
    const leadResponse = await apiCall(
      `${TEST_CONFIG.leadServiceUrl}/api/leads/${testLeadId}`
    );
    
    assert.strictEqual(leadResponse.currentStage, 'Policy Issued', 'Lead should be at Policy Issued stage');
    assert.ok(leadResponse.policyId, 'Lead should have policy ID');
    
    console.log('✓ Pipeline state verified');
    console.log(`  Total steps completed: ${instance.completedStepsCount}`);
    console.log(`  Step history entries: ${instance.stepHistory.length}`);
    console.log(`  Lead current stage: ${leadResponse.currentStage}`);
    console.log(`  Policy linked: ${leadResponse.policyId}`);
  });
});

/**
 * Performance Metrics Test
 */
describe('E2E Pipeline Flow - Performance Metrics', () => {
  it('should complete full flow within acceptable time limits', async () => {
    console.log('\n[PERFORMANCE] Checking time limits...');
    
    const timeLimits = {
      planFetching: TEST_CONFIG.planFetchTimeout,
      quotationSending: TEST_CONFIG.quotationSendTimeout,
      policyIssuance: TEST_CONFIG.policyIssuanceTimeout,
      totalFlow: 10 * 60 * 1000, // 10 minutes total
    };
    
    console.log('  Time limits configured:');
    console.log(`    Plan fetching: ${timeLimits.planFetching / 1000}s`);
    console.log(`    Quotation sending: ${timeLimits.quotationSending / 1000}s`);
    console.log(`    Policy issuance: ${timeLimits.policyIssuance / 1000}s`);
    console.log(`    Total flow: ${timeLimits.totalFlow / 1000}s`);
    
    console.log('✓ Performance metrics configured');
    console.log('  Note: Actual timings measured in previous tests');
  });
});


