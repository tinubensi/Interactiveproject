/**
 * Base Vendor Adapter
 * Abstract base class for vendor-specific API integrations
 */

import { Plan } from '../../models/plan';

/**
 * Vendor API Configuration
 */
export interface VendorApiConfig {
  baseUrl: string;
  subscriptionKey?: string;
  credentials?: {
    username: string;
    password: string;
    secretKey?: string;
  };
  authType?: 'none' | 'apiKey' | 'bearer' | 'oauth' | 'basic';
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Vendor API Result
 * Standardized return format for vendor API calls
 */
export interface VendorApiResult {
  vendorId: string;
  plans: Plan[];
  success: boolean;
  error?: string;
  executionTime: string;
  metadata?: {
    quotationNo?: string;
    memberSnos?: number[];
    memberCount?: number;
    [key: string]: any;
  };
}

/**
 * Base Vendor Adapter
 * Abstract class that all vendor-specific adapters must extend
 */
export abstract class BaseVendorAdapter {
  protected config: VendorApiConfig;
  protected vendorId: string;
  protected vendorName: string;

  constructor(vendorId: string, vendorName: string, config: VendorApiConfig) {
    this.vendorId = vendorId;
    this.vendorName = vendorName;
    this.config = config;
  }

  /**
   * Main entry point - orchestrates the entire flow
   * This is the method called by the VendorApiService
   */
  abstract fetchPlans(leadData: any): Promise<VendorApiResult>;

  /**
   * Authenticate and obtain access token
   * Should handle token caching internally
   */
  protected abstract authenticate(): Promise<string>;

  /**
   * Transform our lead data to vendor-specific format
   * Each vendor has different field names, codes, and requirements
   */
  protected abstract transformLead(leadData: any): any;

  /**
   * Normalize vendor response to StandardPlan format
   * Converts vendor-specific product structure to our unified model
   */
  protected abstract normalizePlans(vendorData: any, leadId: string): Plan[];

  /**
   * Handle vendor-specific errors
   * Returns a user-friendly error message
   */
  protected abstract handleError(error: any): string;

  /**
   * Helper: Parse numeric value from string
   * Handles various formats: "AED 1,234.56", "$ 5,000", "10%"
   */
  protected parseNumber(value: any): number {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return value;

    // Remove all non-numeric characters except decimal point and minus
    const cleaned = String(value).replace(/[^\d.-]+/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Helper: Clean text by removing extra whitespace
   */
  protected cleanText(text: any): string {
    if (!text) return '';
    return String(text).trim().replace(/\s+/g, ' ');
  }

  /**
   * Helper: Format date to ISO string
   */
  protected formatDate(date: Date | string): string {
    if (date instanceof Date) {
      return date.toISOString().split('T')[0];
    }
    if (typeof date === 'string') {
      // Assume it's already in a valid format
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toISOString().split('T')[0];
      }
    }
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Helper: Format date to ISO 8601 date-time (YYYY-MM-DDTHH:mm:ss.sssZ)
   */
  protected formatDateTime(date: Date | string): string {
    if (date instanceof Date) {
      return date.toISOString(); // Full ISO 8601 with milliseconds and Z
    }
    if (typeof date === 'string') {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        return d.toISOString(); // Full ISO 8601 with milliseconds and Z
      }
    }
    return new Date().toISOString();
  }

  /**
   * Helper: Calculate age from date of birth
   */
  protected calculateAge(dateOfBirth: string | Date): number {
    const dob = typeof dateOfBirth === 'string' ? new Date(dateOfBirth) : dateOfBirth;
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  /**
   * Helper: Extract phone number from phone object or string
   */
  protected extractPhoneNumber(phone: any): string {
    if (!phone) return '';

    // Handle string format
    if (typeof phone === 'string') {
      let number = phone.trim();
      // Remove + and country code prefix
      if (number.startsWith('+')) number = number.substring(1);
      if (number.startsWith('971')) number = number.substring(3);
      return number.trim();
    }

    // Handle object format
    if (typeof phone === 'object' && phone.number) {
      let number = phone.number;
      const countryCode = phone.countryCode || '';
      if (countryCode && number.startsWith(countryCode)) {
        number = number.substring(countryCode.length);
      }
      return number.trim();
    }

    return '';
  }

  /**
   * Helper: Generate UUID v4
   */
  protected generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Helper: Sleep/delay execution
   */
  protected async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Helper: Make HTTP request with timeout
   */
  protected async makeRequest(
    url: string,
    options: RequestInit,
    timeoutMs?: number
  ): Promise<Response> {
    const timeout = timeoutMs || this.config.timeout || 30000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
}
