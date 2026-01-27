/**
 * Reference ID Generator for Quotations
 * Format: QUOT-2024-001, QUOT-2024-002, etc.
 */

import { cosmosService } from '../services/cosmosService';

export async function generateQuotationReferenceId(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `QUOT-${year}`;

  // Query for the latest quotation this year
  const query = {
    query: `SELECT VALUE COUNT(1) FROM c WHERE STARTSWITH(c.referenceId, @prefix)`,
    parameters: [{ name: '@prefix', value: prefix }]
  };

  try {
    // For now, use timestamp-based unique ID
    const timestamp = Date.now().toString().slice(-6);
    return `${prefix}-${timestamp}`;
  } catch (error) {
    console.error('Error generating reference ID:', error);
    // Fallback to UUID-based
    return `${prefix}-${Date.now()}`;
  }
}

export function generateRevisionReferenceId(baseReferenceId: string, version: number): string {
  return `${baseReferenceId}-REV${version}`;
}


