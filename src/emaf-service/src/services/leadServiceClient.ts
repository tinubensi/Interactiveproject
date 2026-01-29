/**
 * Lead Service Client
 * Client for communicating with the Lead Service to fetch lead data
 */

import { getConfig } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface LeadData {
  id: string;
  referenceId: string;
  lineOfBusiness: string;
  businessType: string;
  customerId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: {
    number: string;
    countryCode: string;
    isoCode: string;
  };
  emirate: string;
  lobData?: Record<string, unknown>;
  [key: string]: unknown;
}

// =============================================================================
// Service URL Helpers
// =============================================================================

function getLeadServiceUrl(): string {
  const config = getConfig();
  return config.services.leadServiceUrl;
}

/**
 * Get lead data by ID
 * @param leadId - Lead ID
 * @param lineOfBusiness - Line of business (e.g., 'medical')
 * @returns Lead data or null if not found
 */
export async function getLead(
  leadId: string,
  lineOfBusiness: string
): Promise<LeadData | null> {
  const baseUrl = getLeadServiceUrl();
  const config = getConfig();
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const response = await fetch(
      `${baseUrl}/leads/${leadId}?lineOfBusiness=${lineOfBusiness}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': config.auth.serviceKey,
        },
        signal: controller.signal,
      }
    );
    
    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get lead: ${response.statusText}`);
    }

    const result = await response.json() as { data?: { lead?: LeadData }; lead?: LeadData };
    return result.data?.lead || result.lead || (result as unknown as LeadData);
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Handle timeout and other errors gracefully
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error(`⏱️ Timeout fetching lead data: ${leadId}`);
    } else {
      console.error(`❌ Error getting lead ${leadId}:`, error.message || error);
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    }
    return null;
  }
}
