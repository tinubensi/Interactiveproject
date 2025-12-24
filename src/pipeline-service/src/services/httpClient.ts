/**
 * HTTP Client Service
 * Handles synchronous API calls to other services
 */

export interface HttpClientConfig {
  method: string;
  url: string;
  data?: any;
  timeout: number;
  headers?: Record<string, string>;
}

/**
 * Make HTTP request with timeout support
 */
export async function httpRequest(config: HttpClientConfig): Promise<any> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeout);

  try {
    const response = await fetch(config.url, {
      method: config.method,
      headers: {
        'Content-Type': 'application/json',
        ...config.headers,
      },
      body: config.data ? JSON.stringify(config.data) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${config.timeout}ms`);
    }
    throw error;
  }
}

/**
 * Get service URL - routes through APIM if configured, otherwise direct
 */
export function getServiceUrl(serviceName: string): string {
  // Route through APIM if configured
  const apimUrl = process.env.APIM_GATEWAY_URL;
  if (apimUrl) {
    return `${apimUrl}/${serviceName}`;
  }
  
  // Fallback to direct URLs
  const urls: Record<string, string> = {
    'lead-service': process.env.LEAD_SERVICE_URL || '',
    'quotation-gen': process.env.QUOTATION_GEN_SERVICE_URL || '',
    'quotation-service': process.env.QUOTATION_SERVICE_URL || '',
    'policy-service': process.env.POLICY_SERVICE_URL || '',
  };
  
  const url = urls[serviceName];
  if (!url) {
    throw new Error(`Service URL not configured for: ${serviceName}`);
  }
  
  return url;
}

