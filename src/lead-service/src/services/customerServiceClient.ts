/**
 * Customer Service Client
 * Service-to-service API client for communicating with Customer Service
 */

import axios, { AxiosInstance, AxiosError } from 'axios';

const CUSTOMER_SERVICE_URL = process.env.CUSTOMER_SERVICE_URL || 'https://customer-service-aga2dtcehrc4gwhr.uaenorth-01.azurewebsites.net';
const INTERNAL_SERVICE_KEY = process.env.INTERNAL_SERVICE_KEY || 'dev-internal-service-key-nectaria-2024';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Customer Types (matching customer-service)
export type CustomerType = 'INDIVIDUAL' | 'COMPANY';

export interface Customer {
  id: string;
  customerType: CustomerType;
  // INDIVIDUAL fields
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  gender?: string;
  // COMPANY fields
  companyName?: string;
  email1?: string;
  phoneNumber1?: string;
}

export interface SignupRequest {
  customerType: CustomerType;
  // Individual fields
  firstName?: string;
  lastName?: string;
  name?: string;
  email?: string;
  phoneNumber?: string;
  gender?: string;
  agent?: string;
  currency?: string;
  // Company fields
  companyName?: string;
  email1?: string;
  phoneNumber1?: string;
}

class CustomerServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: CUSTOMER_SERVICE_URL,
      timeout: 10000, // 10 seconds
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': INTERNAL_SERVICE_KEY,
      },
    });
  }

  /**
   * Retry helper function for failed requests
   */
  private async retryRequest<T>(
    fn: () => Promise<T>,
    retries: number = MAX_RETRIES
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        await this.delay(RETRY_DELAY);
        return this.retryRequest(fn, retries - 1);
      }
      throw error;
    }
  }

  /**
   * Check if error is retryable (network errors, 5xx errors)
   */
  private isRetryableError(error: any): boolean {
    if (!error.response) {
      // Network error
      return true;
    }
    const status = error.response.status;
    // Retry on 5xx errors, but not on 4xx (client errors)
    return status >= 500 && status < 600;
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if customer exists by email
   * Uses the existing GET /api/customers endpoint which returns all customers
   * Then filters by email on the client side
   */
  async checkCustomerByEmail(email: string): Promise<Customer | null> {
    try {
      const response = await this.retryRequest(async () => {
        return await this.client.get('/api/customers');
      });

      const customers = response.data?.customers || [];
      
      // Find customer by email (check both INDIVIDUAL.email and COMPANY.email1)
      const customer = customers.find((c: Customer) => {
        if (c.customerType === 'INDIVIDUAL') {
          return c.email?.toLowerCase() === email.toLowerCase();
        } else if (c.customerType === 'COMPANY') {
          return c.email1?.toLowerCase() === email.toLowerCase();
        }
        return false;
      });

      return customer || null;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error checking customer by email:', axiosError.message);
      
      // Return null instead of throwing to allow graceful fallback
      return null;
    }
  }

  /**
   * Create a new customer
   * Calls POST /api/customers/signup
   */
  async createCustomer(customerData: SignupRequest): Promise<Customer> {
    try {
      const response = await this.retryRequest(async () => {
        return await this.client.post('/api/customers/signup', customerData);
      });

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error('Error creating customer:', axiosError.message);
      
      // If it's a 409 conflict (customer already exists), try to fetch it
      if (axiosError.response?.status === 409) {
        const email = customerData.customerType === 'INDIVIDUAL' 
          ? customerData.email 
          : customerData.email1;
        
        if (email) {
          const existingCustomer = await this.checkCustomerByEmail(email);
          if (existingCustomer) {
            console.log('Customer already exists, returning existing customer');
            return existingCustomer;
          }
        }
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const customerServiceClient = new CustomerServiceClient();
