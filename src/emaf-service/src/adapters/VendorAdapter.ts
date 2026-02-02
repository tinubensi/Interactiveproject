/**
 * Vendor Adapter Interface
 * Defines the contract for converting between vendor-specific formats and canonical model
 */

import { UnifiedEmafData } from '../models/canonicalEmafTypes';

export interface VendorAdapter {
  /**
   * Get the vendor ID this adapter handles
   */
  getVendorId(): string;
  
  /**
   * Convert vendor-specific data format to canonical model
   */
  toCanonical(vendorData: Record<string, any>): UnifiedEmafData;
  
  /**
   * Convert canonical model to vendor-specific data format
   */
  fromCanonical(canonicalData: UnifiedEmafData): Record<string, any>;
}
