/**
 * Adapter Registry
 * Manages vendor adapters and provides access to them
 */

import { VendorAdapter } from './VendorAdapter';
import { SukoonAdapter } from './SukoonAdapter';
import { AlSagrAdapter } from './AlSagrAdapter';

class AdapterRegistry {
  private adapters = new Map<string, VendorAdapter>();

  constructor() {
    this.registerAdapter(new SukoonAdapter());
    this.registerAdapter(new AlSagrAdapter());
  }

  /**
   * Register a new vendor adapter
   */
  registerAdapter(adapter: VendorAdapter): void {
    this.adapters.set(this.normalizeVendorId(adapter.getVendorId()), adapter);
  }

  /**
   * Get adapter for a specific vendor
   */
  getAdapter(vendorId: string): VendorAdapter {
    const normalized = this.normalizeVendorId(vendorId);
    const adapter = this.adapters.get(normalized);
    
    if (!adapter) {
      throw new Error(`No adapter registered for vendor: ${vendorId}`);
    }
    
    return adapter;
  }

  /**
   * Normalize vendor ID to handle various formats
   */
  private normalizeVendorId(vendorId: string): string {
    const normalized = vendorId.toLowerCase().trim();
    if (normalized.includes('alsagr') || normalized.includes('al-sagr')) {
      return 'alsagr';
    }
    if (normalized.includes('sukoon')) {
      return 'sukoon';
    }
    return normalized;
  }
}

export const adapterRegistry = new AdapterRegistry();
