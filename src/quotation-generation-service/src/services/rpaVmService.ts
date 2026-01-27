import axios, { AxiosError } from 'axios';
import { cosmosService } from './cosmosService';

export interface VmRpaResult {
  vendorId: string;
  plans: any[];
  success: boolean;
  error?: string;
  executionTime?: string;
}

class RpaVmService {
  private vmBaseUrl: string;
  private timeout: number;

  constructor() {
    this.vmBaseUrl = process.env.RPA_VM_URL || '';
    this.timeout = parseInt(process.env.RPA_VM_TIMEOUT || '900000'); // 15 min default (bots can take up to 15 minutes)
    
    if (!this.vmBaseUrl) {
      console.warn('⚠️ RPA_VM_URL not configured - RPA via VM will not work');
    } else {
      console.log(`✅ RPA VM Service initialized: ${this.vmBaseUrl}`);
    }
  }

  isEnabled(): boolean {
    return !!this.vmBaseUrl;
  }

  async fetchPlansFromVendor(vendorId: string, leadData: any): Promise<VmRpaResult> {
    if (!this.vmBaseUrl) {
      return {
        vendorId,
        plans: [],
        success: false,
        error: 'RPA_VM_URL not configured'
      };
    }

    const vendorName = vendorId.replace('vendor-', '');
    const endpoint = `${this.vmBaseUrl}/api/${vendorName}/scrape`;
    
    console.log(`[RPA VM] Calling ${vendorName} at ${endpoint}`);
    
    try {
      const response = await axios.post(
        endpoint,
        { leadData },
        { 
          timeout: this.timeout,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      
      if (response.data.success) {
        console.log(`[RPA VM] ${vendorName} returned ${response.data.plans.length} plans`);
        return {
          vendorId,
          plans: response.data.plans || [],
          success: true,
          executionTime: response.data.executionTime
        };
      } else {
        throw new Error(response.data.error || 'Bot returned success=false');
      }
      
    } catch (error) {
      const axiosError = error as AxiosError;
      const errorData = axiosError.response?.data as any;
      const errorMsg = errorData?.error || axiosError.message || 'Unknown error';
      console.error(`[RPA VM] ${vendorName} failed:`, errorMsg);
      
      return {
        vendorId,
        plans: [],
        success: false,
        error: errorMsg
      };
    }
  }

  async fetchPlansFromAllVendors(
    leadId: string,
    leadData: any,
    vendorIds: string[]
  ): Promise<VmRpaResult[]> {
    if (vendorIds.length === 0) {
      console.log('[RPA VM] No vendors to process');
      return [];
    }

    console.log(`[RPA VM] Fetching plans from ${vendorIds.length} vendors in parallel`);
    
    // Track results as they arrive
    const vmResults: VmRpaResult[] = [];
    
    // Call all vendors in parallel and save results IMMEDIATELY when each completes
    const promises = vendorIds.map(async (vendorId) => {
      try {
        const result = await this.fetchPlansFromVendor(vendorId, leadData);
        
        // IMMEDIATE SAVE: Save plans to Cosmos DB as soon as vendor completes
        if (result.success && result.plans.length > 0) {
          try {
            await this.savePlansToCosmosDB(leadId, result.vendorId, result.plans);
            console.log(`[RPA VM] ✅ IMMEDIATELY saved ${result.plans.length} plans from ${result.vendorId}`);
          } catch (saveError) {
            console.error(`[RPA VM] Failed to save plans from ${result.vendorId}:`, saveError);
            // Mark as failed if save fails
            result.success = false;
            result.error = `Save failed: ${saveError}`;
          }
        }
        
        vmResults.push(result);
        return result;
      } catch (error: any) {
        const failedResult: VmRpaResult = {
          vendorId,
          plans: [],
          success: false,
          error: error?.message || 'Unknown error'
        };
        vmResults.push(failedResult);
        return failedResult;
      }
    });
    
    // Wait for all vendors to complete
    await Promise.allSettled(promises);
    
    return vmResults;
  }

  private async savePlansToCosmosDB(leadId: string, vendorId: string, plans: any[]) {
    // Get Cosmos client for lead-service-db (where plans are stored)
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING must be set');
    }
    
    const { CosmosClient } = await import('@azure/cosmos');
    const client = new CosmosClient(connectionString);
    const database = client.database('lead-service-db');
    const container = database.container('plans');
    
    for (const plan of plans) {
      try {
        // Ensure planCode or id exists for document ID
        const planIdentifier = plan.planCode || plan.id || `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const docId = `${leadId}_${vendorId}_${planIdentifier}`;
        
        const planDoc = {
          id: docId,
          type: 'plan',
          leadId,
          vendorId,
          fetchedAt: new Date().toISOString(),
          ...plan
        };
        
        // Validate required fields
        if (!planDoc.leadId || !planDoc.vendorId) {
          console.error(`[RPA VM] Plan missing required fields: leadId=${planDoc.leadId}, vendorId=${planDoc.vendorId}`);
          continue;
        }
        
        await container.items.upsert(planDoc);
        console.log(`[RPA VM] Saved plan: ${docId} (${planDoc.planName || planDoc.planCode || 'Unknown'})`);
      } catch (planError: any) {
        console.error(`[RPA VM] Failed to save individual plan:`, planError);
        console.error(`[RPA VM] Plan data:`, JSON.stringify(plan, null, 2).substring(0, 500));
        // Continue with next plan instead of failing entire batch
      }
    }
  }

  /**
   * Verify plans are saved and queryable in Cosmos DB
   * This handles eventual consistency by actually querying the database
   */
  async verifyPlansInDB(leadId: string): Promise<{ count: number; vendors: string[] }> {
    const connectionString = process.env.COSMOS_CONNECTION_STRING;
    if (!connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING must be set');
    }
    
    const { CosmosClient } = await import('@azure/cosmos');
    const client = new CosmosClient(connectionString);
    const database = client.database('lead-service-db');
    const container = database.container('plans');
    
    // Use simple query to get all plans (avoid GROUP BY which can fail)
    const { resources: plans } = await container.items
      .query({
        query: 'SELECT c.vendorId, c.planCode FROM c WHERE c.leadId = @leadId AND c.type = @type',
        parameters: [
          { name: '@leadId', value: leadId },
          { name: '@type', value: 'plan' }
        ]
      })
      .fetchAll();
    
    // Count unique vendors
    const vendorSet = new Set<string>();
    for (const plan of plans) {
      if (plan.vendorId) {
        vendorSet.add(plan.vendorId);
      }
    }
    
    // Count unique plans by planCode (deduplication)
    const uniquePlanCodes = new Set(plans.map((p: any) => p.planCode));
    const uniqueCount = uniquePlanCodes.size;
    
    console.log(`[RPA VM] Verified ${plans.length} total plans (${uniqueCount} unique) from ${vendorSet.size} vendors`);
    
    return { 
      count: uniqueCount, // Return unique count, not total
      vendors: Array.from(vendorSet) 
    };
  }
}

export const rpaVmService = new RpaVmService();

