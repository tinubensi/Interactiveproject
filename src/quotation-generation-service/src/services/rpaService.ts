/**
 * RPA Service
 * Triggers RPA bots to fetch plans from insurance portals
 */

export class RPAService {
  private rpaUrl: string;
  private rpaKey: string;

  constructor() {
    this.rpaUrl = process.env.RPA_TRIGGER_URL || 
      'https://crm-vendor-rpa-func.azurewebsites.net/api/rpa_trigger_http';
    this.rpaKey = process.env.RPA_TRIGGER_KEY || '';
    
    if (!this.rpaKey) {
      console.warn('⚠️ RPA_TRIGGER_KEY not set in environment variables');
    }
    
    console.log(`RPA Service initialized with URL: ${this.rpaUrl}`);
  }

  /**
   * Trigger RPA to fetch plans for a lead
   * 
   * @param leadData - Lead information including LOB, contact details, etc.
   * @returns Success status and triggered vendor count
   */
  async triggerRPA(leadData: {
    leadId: string;
    lineOfBusiness: string;
    businessType?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: any;
    emirate?: string;
    lobData?: any;
    [key: string]: any;
  }): Promise<{
    success: boolean;
    vendorsTriggered: string[];
    vendorsFailed: any[];
    plans?: any[]; // 🔧 FIX: Include plans in response
    error?: string;
  }> {
    try {
      console.log(`🤖 Triggering RPA for lead ${leadData.leadId}...`);
      
      const response = await fetch(`${this.rpaUrl}?code=${this.rpaKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(leadData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`RPA trigger failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result: any = await response.json();
      
      console.log(`✅ RPA triggered successfully for lead ${leadData.leadId}`);
      console.log(`   Vendors triggered: ${result.vendorsTriggered?.length || 0}`);
      console.log(`   Vendors failed: ${result.vendorsFailed?.length || 0}`);
      console.log(`   Plans returned: ${result.plans?.length || 0}`); // 🔧 FIX: Log plan count

      return {
        success: true,
        vendorsTriggered: result.vendorsTriggered || [],
        vendorsFailed: result.vendorsFailed || [],
        plans: result.plans || [] // 🔧 FIX: Include plans in return value
      };
      
    } catch (error: any) {
      console.error('❌ RPA trigger failed:', error);
      return {
        success: false,
        vendorsTriggered: [],
        vendorsFailed: [],
        plans: [],
        error: error.message
      };
    }
  }

  /**
   * Wait for RPA to complete by polling the database
   * 
   * @param leadId - Lead ID to check for plans
   * @param maxWaitSeconds - Maximum time to wait in seconds
   * @param pollIntervalSeconds - How often to check in seconds
   * @returns Number of plans found
   */
  async waitForRPACompletion(
    leadId: string,
    checkPlansExist: () => Promise<number>,
    maxWaitSeconds: number = 180,
    pollIntervalSeconds: number = 10
  ): Promise<number> {
    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    const pollIntervalMs = pollIntervalSeconds * 1000;

    console.log(`⏳ Waiting for RPA to fetch plans (max ${maxWaitSeconds}s)...`);

    while (Date.now() - startTime < maxWaitMs) {
      // Check if plans exist
      const planCount = await checkPlansExist();
      
      if (planCount > 0) {
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        console.log(`✅ RPA completed! Found ${planCount} plans after ${elapsedSeconds}s`);
        return planCount;
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      
      const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
      console.log(`   Still waiting... (${elapsedSeconds}s elapsed)`);
    }

    console.warn(`⚠️ RPA timeout after ${maxWaitSeconds}s - no plans found yet`);
    return 0;
  }
}

export const rpaService = new RPAService();

