/**
 * Reference ID Generator
 * Generates human-readable reference IDs for leads
 * Reference: Petli reference ID generation logic
 */

import { cosmosService } from '../services/cosmosService';

/**
 * Generate lead reference ID
 * Format: LEAD-YYYY-NNNN
 * Example: LEAD-2024-0001
 */
export async function generateLeadReferenceId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LEAD-${year}`;

  // Count leads created this year
  const query = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE STARTSWITH(c.referenceId, @prefix) AND NOT IS_DEFINED(c.deletedAt)`,
    parameters: [{ name: '@prefix', value: prefix }]
  };

  try {
    // Get count from Cosmos DB
    const container = (cosmosService as any).leadsContainer;
    const { resources } = await container.items.query(query).fetchAll();
    const count = resources[0] || 0;

    // Generate new reference ID
    const sequence = String(count + 1).padStart(4, '0');
    return `${prefix}-${sequence}`;
  } catch (error) {
    console.error('Error generating reference ID:', error);
    // Fallback to timestamp-based ID
    const timestamp = Date.now();
    return `${prefix}-${timestamp}`;
  }
}

/**
 * Validate reference ID format
 */
export function validateReferenceId(referenceId: string): boolean {
  const pattern = /^LEAD-\d{4}-\d{4}$/;
  return pattern.test(referenceId);
}

/**
 * Extract year from reference ID
 */
export function extractYearFromReferenceId(referenceId: string): number | null {
  const match = referenceId.match(/^LEAD-(\d{4})-\d{4}$/);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extract sequence number from reference ID
 */
export function extractSequenceFromReferenceId(referenceId: string): number | null {
  const match = referenceId.match(/^LEAD-\d{4}-(\d{4})$/);
  return match ? parseInt(match[1], 10) : null;
}


