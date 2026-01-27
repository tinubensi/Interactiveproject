/**
 * Vendor API Service
 * Orchestrates vendor API integrations using the adapter pattern
 */

import { BaseVendorAdapter, VendorApiConfig, VendorApiResult } from './vendorAdapters/baseVendorAdapter';
import { TakafulAdapter } from './vendorAdapters/takafulAdapter';
import { Vendor } from '../models/plan';

class VendorApiService {
  private adapters: Map<string, BaseVendorAdapter> = new Map();

  /**
   * Initialize adapter for a vendor
   * Uses factory pattern to create appropriate adapter based on vendor code
   */
  initializeAdapter(vendor: Vendor): BaseVendorAdapter {
    // Check if already initialized
    if (this.adapters.has(vendor.id)) {
      return this.adapters.get(vendor.id)!;
    }

    let adapter: BaseVendorAdapter;

    // Factory pattern - create appropriate adapter based on vendor code
    switch (vendor.code.toUpperCase()) {
      case 'TKF':
      case 'TAKAFUL':
        adapter = new TakafulAdapter({
          baseUrl: vendor.apiEndpoint!,
          subscriptionKey: vendor.apiKey!,
          credentials: {
            username: process.env.TAKAFUL_USERNAME!,
            password: process.env.TAKAFUL_PASSWORD!,
            secretKey: process.env.TAKAFUL_SECRET_KEY!,
          },
          timeout: vendor.apiTimeout || 60000,
        });
        break;

      // Add more vendors here as they're implemented:
      // case 'SUKOON':
      //   adapter = new SukoonAdapter({...});
      //   break;
      //
      // case 'ALS':
      // case 'ALSAGR':
      //   adapter = new AlsagrAdapter({...});
      //   break;

      default:
        throw new Error(`No adapter implemented for vendor: ${vendor.code}`);
    }

    // Cache the adapter
    this.adapters.set(vendor.id, adapter);
    console.log(`[VendorApiService] Initialized adapter for ${vendor.name} (${vendor.code})`);

    return adapter;
  }

  /**
   * Fetch plans from a single vendor using its API adapter
   */
  async fetchPlansFromVendor(vendor: Vendor, leadData: any): Promise<VendorApiResult> {
    try {
      console.log(`[VendorApiService] Fetching plans from ${vendor.name} via API...`);

      const adapter = this.initializeAdapter(vendor);
      const result = await adapter.fetchPlans(leadData);

      if (result.success) {
        console.log(
          `[VendorApiService] ✅ ${vendor.name} API returned ${result.plans.length} plan(s) in ${result.executionTime}`
        );
      } else {
        console.error(`[VendorApiService] ❌ ${vendor.name} API failed: ${result.error}`);
      }

      return result;
    } catch (error: any) {
      console.error(`[VendorApiService] Error fetching from ${vendor.name}:`, error);

      return {
        vendorId: vendor.id,
        plans: [],
        success: false,
        error: error.message || 'Unknown error occurred',
        executionTime: '0s',
      };
    }
  }

  /**
   * Fetch plans from multiple API vendors in parallel
   * Uses Promise.allSettled to handle individual failures gracefully
   */
  async fetchPlansFromMultipleVendors(
    vendors: Vendor[],
    leadData: any
  ): Promise<VendorApiResult[]> {
    if (!vendors || vendors.length === 0) {
      console.log('[VendorApiService] No API vendors to process');
      return [];
    }

    console.log(`[VendorApiService] Fetching plans from ${vendors.length} vendor(s) in parallel...`);

    // Execute all vendor API calls in parallel
    const promises = vendors.map((vendor) => this.fetchPlansFromVendor(vendor, leadData));

    const results = await Promise.allSettled(promises);

    // Process results
    const vendorResults: VendorApiResult[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const vendor = vendors[i];

      if (result.status === 'fulfilled') {
        vendorResults.push(result.value);
      } else {
        // Promise rejected - create failed result
        console.error(`[VendorApiService] ${vendor.name} promise rejected:`, result.reason);
        vendorResults.push({
          vendorId: vendor.id,
          plans: [],
          success: false,
          error: result.reason?.message || 'Promise rejected',
          executionTime: '0s',
        });
      }
    }

    const successCount = vendorResults.filter((r) => r.success).length;
    const totalPlans = vendorResults.reduce((sum, r) => sum + r.plans.length, 0);

    console.log(
      `[VendorApiService] ✅ Completed: ${successCount}/${vendors.length} vendor(s) successful, ${totalPlans} total plan(s)`
    );

    return vendorResults;
  }

  /**
   * Clear cached adapters (useful for testing or credential rotation)
   */
  clearAdapterCache(): void {
    this.adapters.clear();
    console.log('[VendorApiService] Adapter cache cleared');
  }

  /**
   * Get statistics about initialized adapters
   */
  getAdapterStats(): { vendorId: string; vendorName: string }[] {
    const stats: { vendorId: string; vendorName: string }[] = [];

    for (const [vendorId, adapter] of this.adapters.entries()) {
      stats.push({
        vendorId,
        vendorName: (adapter as any).vendorName || 'Unknown',
      });
    }

    return stats;
  }
}

// Export singleton instance
export const vendorApiService = new VendorApiService();
