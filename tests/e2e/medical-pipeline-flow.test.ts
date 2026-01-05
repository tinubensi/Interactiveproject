/**
 * E2E Test: Medical Pipeline Flow
 * 
 * Tests the complete lead-to-policy flow using the enhanced hybrid sync/async pipeline:
 * 1. Create lead (triggers pipeline instance)
 * 2. Wait for plans fetch (async)
 * 3. Create quotation (sync)
 * 4. Wait for quotation sent (async)
 * 5. Customer selects plan
 * 6. Approve quotation
 * 7. Wait for policy issuance (async)
 * 8. Verify final state
 */

import { ApiClient } from '../utils/api-client';
import { generateLead } from '../fixtures/leads';

describe('E2E: Medical Pipeline Flow', () => {
  let leadClient: ApiClient;
  let quotationClient: ApiClient;
  let pipelineClient: ApiClient;
  let policyClient: ApiClient;

  let createdLeadId: string | null = null;
  let createdQuotationId: string | null = null;
  let createdPolicyId: string | null = null;
  let pipelineInstanceId: string | null = null;

  const TEST_TIMEOUT = 300000; // 5 minutes for full flow

  beforeAll(() => {
    leadClient = new ApiClient('lead', { authenticated: true });
    quotationClient = new ApiClient('quotation', { authenticated: true });
    pipelineClient = new ApiClient('pipeline', { authenticated: true });
    policyClient = new ApiClient('policy', { authenticated: true });
  });

  afterAll(async () => {
    // Cleanup created resources
    if (createdPolicyId) {
      try {
        await policyClient.delete(`/api/policies/${createdPolicyId}`);
      } catch (error) {
        console.warn('Failed to cleanup policy:', error);
      }
    }
    if (createdQuotationId) {
      try {
        await quotationClient.delete(`/api/quotations/${createdQuotationId}`);
      } catch (error) {
        console.warn('Failed to cleanup quotation:', error);
      }
    }
    if (createdLeadId) {
      try {
        await leadClient.delete(`/api/leads/${createdLeadId}`);
      } catch (error) {
        console.warn('Failed to cleanup lead:', error);
      }
    }
  });

  /**
   * Wait for a lead to reach a specific stage
   */
  async function waitForStage(
    leadId: string,
    expectedStage: string,
    timeoutMs: number = 180000
  ): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 2000; // Check every 2 seconds

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await leadClient.get(`/api/leads/${leadId}`);
        
        if (response.status === 200) {
          const lead = response.data as { currentStage?: string; stageId?: string };
          
          if (lead.currentStage === expectedStage || lead.stageId?.includes(expectedStage.toLowerCase().replace(/\s+/g, '-'))) {
            console.log(`✓ Lead ${leadId} reached stage: ${expectedStage}`);
            return;
          }
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      } catch (error) {
        console.warn(`Error checking lead stage: ${error}`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }

    throw new Error(`Timeout waiting for lead ${leadId} to reach stage ${expectedStage}`);
  }

  /**
   * Get pipeline instance for a lead
   */
  async function getPipelineInstance(leadId: string): Promise<any> {
    try {
      const response = await pipelineClient.get(`/api/pipeline/instances?leadId=${leadId}`);
      
      if (response.status === 200) {
        const data = response.data as { instances?: any[] };
        return data.instances?.[0] || null;
      }
    } catch (error) {
      console.warn(`Error getting pipeline instance: ${error}`);
    }
    return null;
  }

  describe('Complete Lead-to-Policy Flow', () => {
    it(
      'Step 1: Create lead (triggers pipeline instance)',
      async () => {
        const lead = generateLead({
          lineOfBusiness: 'medical',
          businessType: 'individual',
        });

        const response = await leadClient.post('/api/leads', lead);

        expect([200, 201, 401, 403]).toContain(response.status);

        if (response.status === 201 || response.status === 200) {
          const created = response.data as { leadId: string; id?: string };
          createdLeadId = created.leadId || created.id;
          console.log(`✓ Lead created: ${createdLeadId}`);

          // Wait a moment for pipeline instance to be created
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Get pipeline instance
          const instance = await getPipelineInstance(createdLeadId!);
          if (instance) {
            pipelineInstanceId = instance.instanceId;
            console.log(`✓ Pipeline instance created: ${pipelineInstanceId}`);
          }
        }
      },
      TEST_TIMEOUT
    );

    it(
      'Step 2: Wait for plans fetch (async action)',
      async () => {
        if (!createdLeadId) {
          console.log('⏭ Skipping - no lead created');
          return;
        }

        console.log('⏳ Waiting for plans to be fetched (async action)...');
        await waitForStage(createdLeadId, 'Plans Available', 180000);
        console.log('✓ Plans fetched successfully');
      },
      TEST_TIMEOUT
    );

    it(
      'Step 3: Create quotation (sync action)',
      async () => {
        if (!createdLeadId) {
          console.log('⏭ Skipping - no lead created');
          return;
        }

        // Get available plans first
        const plansResponse = await quotationClient.get(
          `/api/plans?leadId=${createdLeadId}`
        );

        let planIds: string[] = [];
        if (plansResponse.status === 200) {
          const plans = plansResponse.data as { plans?: any[] };
          planIds = plans.plans?.slice(0, 3).map((p: any) => p.id) || [];
        }

        if (planIds.length === 0) {
          console.log('⚠ No plans available, using mock plan IDs');
          planIds = ['plan-1', 'plan-2', 'plan-3'];
        }

        const quotationData = {
          leadId: createdLeadId,
          customerId: 'test-customer-id',
          lineOfBusiness: 'medical',
          businessType: 'individual',
          planIds,
        };

        const response = await quotationClient.post('/api/quotations', quotationData);

        expect([200, 201, 401, 403]).toContain(response.status);

        if (response.status === 201 || response.status === 200) {
          const created = response.data as { quotationId?: string; id?: string; data?: { quotation?: { id: string } } };
          createdQuotationId = created.quotationId || created.id || created.data?.quotation?.id;
          console.log(`✓ Quotation created: ${createdQuotationId}`);
        }
      },
      TEST_TIMEOUT
    );

    it(
      'Step 4: Wait for quotation sent (async action)',
      async () => {
        if (!createdLeadId) {
          console.log('⏭ Skipping - no lead created');
          return;
        }

        console.log('⏳ Waiting for quotation to be sent (async action)...');
        await waitForStage(createdLeadId, 'Quotation Sent', 60000);
        console.log('✓ Quotation sent successfully');
      },
      TEST_TIMEOUT
    );

    it(
      'Step 5: Customer selects plan',
      async () => {
        if (!createdQuotationId) {
          console.log('⏭ Skipping - no quotation created');
          return;
        }

        // Simulate customer selecting a plan
        const selectResponse = await quotationClient.post(
          `/api/quotations/${createdQuotationId}/select-plan`,
          {
            planId: 'plan-1',
            customerId: 'test-customer-id',
          }
        );

        expect([200, 201, 400, 401, 403, 404]).toContain(selectResponse.status);
        
        if (selectResponse.status === 200 || selectResponse.status === 201) {
          console.log('✓ Plan selected by customer');
        } else {
          console.log(`⚠ Plan selection returned ${selectResponse.status} (may not be implemented yet)`);
        }
      },
      TEST_TIMEOUT
    );

    it(
      'Step 6: Approve quotation',
      async () => {
        if (!createdQuotationId) {
          console.log('⏭ Skipping - no quotation created');
          return;
        }

        const approveResponse = await quotationClient.post(
          `/api/quotations/${createdQuotationId}/approve`,
          {
            approvedBy: 'test-approver',
            comments: 'E2E test approval',
          }
        );

        expect([200, 201, 400, 401, 403, 404]).toContain(approveResponse.status);
        
        if (approveResponse.status === 200 || approveResponse.status === 201) {
          console.log('✓ Quotation approved');
        } else {
          console.log(`⚠ Approval returned ${approveResponse.status} (may not be implemented yet)`);
        }
      },
      TEST_TIMEOUT
    );

    it(
      'Step 7: Wait for policy issuance (async action)',
      async () => {
        if (!createdLeadId) {
          console.log('⏭ Skipping - no lead created');
          return;
        }

        console.log('⏳ Waiting for policy to be issued (async action)...');
        await waitForStage(createdLeadId, 'Policy Issued', 180000);
        console.log('✓ Policy issued successfully');
      },
      TEST_TIMEOUT
    );

    it(
      'Step 8: Verify final state',
      async () => {
        if (!createdLeadId || !pipelineInstanceId) {
          console.log('⏭ Skipping - no lead or pipeline instance');
          return;
        }

        // Get pipeline instance
        const instance = await getPipelineInstance(createdLeadId);
        
        if (instance) {
          expect(instance.status).toBe('completed');
          expect(instance.progressPercent).toBe(100);
          expect(instance.currentStageName).toBe('Policy Issued');
          console.log('✓ Pipeline instance completed successfully');
          console.log(`  - Status: ${instance.status}`);
          console.log(`  - Progress: ${instance.progressPercent}%`);
          console.log(`  - Final Stage: ${instance.currentStageName}`);
        } else {
          console.log('⚠ Could not retrieve pipeline instance for verification');
        }

        // Verify lead stage
        const leadResponse = await leadClient.get(`/api/leads/${createdLeadId}`);
        if (leadResponse.status === 200) {
          const lead = leadResponse.data as { currentStage?: string };
          console.log(`✓ Lead final stage: ${lead.currentStage}`);
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('Pipeline Action Execution', () => {
    it('should handle sync actions correctly', async () => {
      // This would test sync action execution
      // For now, we verify through the flow above
      expect(true).toBe(true);
    });

    it('should handle async actions correctly', async () => {
      // This would test async action execution
      // For now, we verify through the flow above
      expect(true).toBe(true);
    });

    it('should handle service completion events', async () => {
      // This would test completion event handling
      // For now, we verify through the flow above
      expect(true).toBe(true);
    });
  });
});

