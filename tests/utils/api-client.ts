/**
 * HTTP API client for integration tests
 */

import { SERVICES, TEST_CONFIG, getServiceUrl } from './config';

export interface ApiResponse<T = unknown> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Create an authenticated request with test user token
 */
function createAuthHeaders(userId?: string, roles?: string[]): Record<string, string> {
  // For testing, we create a mock token that the services will accept
  // In real integration tests with running services, this would be a real JWT
  const user = {
    userId: userId || TEST_CONFIG.testUser.userId,
    email: TEST_CONFIG.testUser.email,
    roles: roles || TEST_CONFIG.testUser.roles,
  };
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer test-token-${user.userId}`,
    'X-User-Context': Buffer.from(JSON.stringify(user)).toString('base64'),
  };
}

/**
 * Create internal service headers
 */
function createServiceHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Service-Key': TEST_CONFIG.internalServiceKey,
  };
}

/**
 * Generic API client for making HTTP requests to services
 */
export class ApiClient {
  private baseUrl: string;
  private defaultHeaders: Record<string, string>;

  constructor(
    service: keyof typeof SERVICES,
    options?: { authenticated?: boolean; asAdmin?: boolean; asService?: boolean }
  ) {
    this.baseUrl = getServiceUrl(service);
    
    if (options?.asService) {
      this.defaultHeaders = createServiceHeaders();
    } else if (options?.authenticated || options?.asAdmin) {
      const user = options?.asAdmin ? TEST_CONFIG.adminUser : TEST_CONFIG.testUser;
      this.defaultHeaders = createAuthHeaders(user.userId, user.roles);
    } else {
      this.defaultHeaders = { 'Content-Type': 'application/json' };
    }
  }

  async get<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async patch<T = unknown>(path: string, body?: unknown, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, options);
  }

  async delete<T = unknown>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options?: RequestOptions
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...this.defaultHeaders, ...options?.headers };
    const timeout = options?.timeout || TEST_CONFIG.requestTimeout;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: T;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        data = await response.json() as T;
      } else {
        data = await response.text() as unknown as T;
      }

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      return {
        status: response.status,
        data,
        headers: responseHeaders,
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms: ${method} ${url}`);
      }
      throw error;
    }
  }
}

/**
 * Create pre-configured API clients
 */
export const createAuthClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('authentication', { authenticated: true, ...options });

export const createAuthzClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('authorization', { authenticated: true, ...options });

export const createAuditClient = (options?: { asAdmin?: boolean; asService?: boolean }) => 
  new ApiClient('audit', { authenticated: true, ...options });

export const createStaffClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('staffManagement', { authenticated: true, ...options });

export const createNotificationClient = (options?: { asAdmin?: boolean; asService?: boolean }) => 
  new ApiClient('notification', { authenticated: true, ...options });

export const createWorkflowClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('workflow', { authenticated: true, ...options });

export const createCustomerClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('customer', { authenticated: true, ...options });

export const createLeadClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('lead', { authenticated: true, ...options });

export const createFormClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('form', { authenticated: true, ...options });

export const createDocumentClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('document', { authenticated: true, ...options });

export const createQuotationClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('quotation', { authenticated: true, ...options });

export const createPolicyClient = (options?: { asAdmin?: boolean }) => 
  new ApiClient('policy', { authenticated: true, ...options });

