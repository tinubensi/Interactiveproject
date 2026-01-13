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
    this.timeout = parseInt(process.env.RPA_VM_TIMEOUT || '300000'); // 5 min default
    
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
    
    // Call all vendors in parallel
    const promises = vendorIds.map(vendorId =>
      this.fetchPlansFromVendor(vendorId, leadData)
    );
    
    const results = await Promise.allSettled(promises);
    
    // Extract results
    const vmResults: VmRpaResult[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled') {
        vmResults.push(result.value);
      } else {
        console.error('[RPA VM] Promise rejected:', result.reason);
        vmResults.push({
          vendorId: 'unknown',
          plans: [],
          success: false,
          error: result.reason?.message || 'Promise rejected'
        });
      }
    }
    
    // Save successful plans to Cosmos DB
    for (const result of vmResults) {
      if (result.success && result.plans.length > 0) {
        try {
          await this.savePlansToCosmosDB(leadId, result.vendorId, result.plans);
          console.log(`[RPA VM] Saved ${result.plans.length} plans from ${result.vendorId}`);
        } catch (saveError) {
          console.error(`[RPA VM] Failed to save plans from ${result.vendorId}:`, saveError);
        }
      }
    }
    
    // Wait for Cosmos DB eventual consistency
    // This ensures plans are queryable before we return
    if (vmResults.some(r => r.success && r.plans.length > 0)) {
      console.log(`[RPA VM] Waiting 3 seconds for Cosmos DB to commit changes...`);
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
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
      const planDoc = {
        id: `${leadId}_${vendorId}_${plan.planCode || plan.id}`,
        type: 'plan',
        leadId,
        vendorId,
        fetchedAt: new Date().toISOString(),
        ...plan
      };
      
      await container.items.upsert(planDoc);
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

