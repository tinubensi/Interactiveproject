import {
  HttpRequestConfig,
  StepResult,
  ExecutionError
} from '../../models/workflowTypes';
import {
  ExpressionContext,
  resolveTemplate,
  resolveObject
} from '../engine/expressionResolver';

export interface HttpExecutorConfig extends Omit<HttpRequestConfig, 'auth'> {
  auth?: {
    type: 'bearer' | 'basic' | 'api-key';
    token?: string;
    username?: string;
    password?: string;
    headerName?: string;
    apiKey?: string;
  };
}

export interface HttpExecutorResult {
  success: boolean;
  data?: unknown;
  statusCode?: number;
  headers?: Record<string, string>;
  error?: ExecutionError;
}

/**
 * Execute an HTTP request
 */
export const executeHttpRequest = async (
  config: HttpExecutorConfig,
  context: ExpressionContext
): Promise<HttpExecutorResult> => {
  try {
    // Resolve URL template
    const url = resolveTemplate(config.url, context);

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Resolve custom headers
    if (config.headers) {
      const resolvedHeaders = resolveObject(config.headers, context) as Record<
        string,
        string
      >;
      Object.assign(headers, resolvedHeaders);
    }

    // Add authentication
    if (config.auth) {
      const authHeader = buildAuthHeader(config.auth, context);
      if (authHeader) {
        Object.assign(headers, authHeader);
      }
    }

    // Resolve and stringify body
    let body: string | undefined;
    if (config.body && config.method !== 'GET') {
      const resolvedBody = resolveObject(config.body, context);
      body = JSON.stringify(resolvedBody);
    }

    // Set timeout
    const timeoutMs = (config.timeout || 30) * 1000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: config.method,
        headers,
        body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parse response body
      const contentType =
        response.headers.get('content-type') ||
        responseHeaders['content-type'] ||
        '';
      let data: unknown;

      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text();
      }

      // Check if status is valid
      const validStatuses = config.validateStatus || [200, 201, 202, 204];
      const isValidStatus = validStatuses.includes(response.status);

      if (!response.ok && !isValidStatus) {
        return {
          success: false,
          statusCode: response.status,
          headers: responseHeaders,
          data,
          error: {
            code: `HTTP_${response.status}`,
            message: `HTTP request failed with status ${response.status}`,
            details: data
          }
        };
      }

      return {
        success: true,
        statusCode: response.status,
        headers: responseHeaders,
        data
      };
    } catch (fetchError) {
      clearTimeout(timeoutId);
      throw fetchError;
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const isTimeout =
      error instanceof Error && error.name === 'AbortError';

    return {
      success: false,
      error: {
        code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: isTimeout
          ? `Request timed out after ${config.timeout || 30} seconds`
          : errorMessage,
        details: error instanceof Error ? error.stack : undefined
      }
    };
  }
};

/**
 * Build authentication header based on auth config
 */
const buildAuthHeader = (
  auth: HttpExecutorConfig['auth'],
  context: ExpressionContext
): Record<string, string> | null => {
  if (!auth) return null;

  switch (auth.type) {
    case 'bearer': {
      const token = auth.token
        ? resolveTemplate(auth.token, context)
        : '';
      return { Authorization: `Bearer ${token}` };
    }

    case 'basic': {
      const username = auth.username
        ? resolveTemplate(auth.username, context)
        : '';
      const password = auth.password
        ? resolveTemplate(auth.password, context)
        : '';
      const credentials = Buffer.from(`${username}:${password}`).toString(
        'base64'
      );
      return { Authorization: `Basic ${credentials}` };
    }

    case 'api-key': {
      const headerName = auth.headerName || 'X-API-Key';
      const apiKey = auth.apiKey
        ? resolveTemplate(auth.apiKey, context)
        : '';
      return { [headerName]: apiKey };
    }

    default:
      return null;
  }
};

/**
 * Create a step result from HTTP executor result
 */
export const httpResultToStepResult = (
  result: HttpExecutorResult
): StepResult => {
  return {
    success: result.success,
    output: result.success ? result.data : undefined,
    error: result.error,
    shouldTerminate: false
  };
};

