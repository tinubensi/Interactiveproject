/**
 * Customer Service Client
 * Client for communicating with the Customer Service to fetch customer data
 */

import { getConfig } from '../config';

// =============================================================================
// Types
// =============================================================================

export interface CustomerData {
  id: string;
  customerType: 'INDIVIDUAL' | 'COMPANY';
  firstName?: string;
  lastName?: string;
  middleName?: string;
  name?: string;
  dateOfBirth?: string;
  email?: string;
  email2?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  faxNumber?: string;
  emiratesId?: string;
  nationality?: string;
  gender?: string;
  address?: string;
  emirate?: string;
  countryOfResidence?: string;
  monthlySalaryRange?: string;
  visaType?: string;
  visaFileNumber?: string;
  visaExpiryDate?: string;
  visaLocation?: string;
  maritalStatus?: string;
  passportNumber?: string;
  occupation?: string;
  homeCountry?: string;
  [key: string]: unknown;
}

// =============================================================================
// Service URL Helpers
// =============================================================================

function getCustomerServiceUrl(): string {
  const config = getConfig();
  return config.services.customerServiceUrl || process.env.CUSTOMER_SERVICE_URL || 'http://localhost:7072';
}

/**
 * Get customer data by ID
 * @param customerId - Customer ID
 * @returns Customer data or null if not found
 */
export async function getCustomer(
  customerId: string
): Promise<CustomerData | null> {
  const baseUrl = getCustomerServiceUrl();
  const config = getConfig();
  
  // Create AbortController for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
  
  try {
    const response = await fetch(
      `${baseUrl}/customers/${customerId}`,
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
      throw new Error(`Failed to get customer: ${response.statusText}`);
    }

    const result = await response.json() as CustomerData | { data?: CustomerData };
    const customer = result.data || result;
    // Type guard to ensure we have a valid CustomerData
    if (customer && typeof customer === 'object' && 'id' in customer) {
      return customer as CustomerData;
    }
    return null;
  } catch (error: any) {
    clearTimeout(timeoutId);
    // Handle timeout and other errors gracefully
    if (error.name === 'AbortError' || error.name === 'TimeoutError') {
      console.error(`⏱️ Timeout fetching customer data: ${customerId}`);
    } else {
      console.error(`❌ Error getting customer ${customerId}:`, error.message || error);
      if (error.stack) {
        console.error('Error stack:', error.stack);
      }
    }
    return null;
  }
}
