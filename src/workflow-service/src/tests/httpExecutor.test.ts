import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import {
  executeHttpRequest,
  HttpExecutorConfig
} from '../lib/executors/httpExecutor';
import { ExpressionContext } from '../lib/engine/expressionResolver';

describe('HTTP Executor', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('executeHttpRequest', () => {
    it('should make GET request successfully', async () => {
      const mockResponse = { id: 123, name: 'Test' };

      global.fetch = mock.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => mockResponse
      })) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items/123',
        method: 'GET'
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeHttpRequest(config, context);

      assert.deepStrictEqual(result.success, true);
      assert.deepStrictEqual(result.data, mockResponse);
      assert.strictEqual(result.statusCode, 200);
    });

    it('should make POST request with body', async () => {
      const mockResponse = { id: 456, created: true };

      global.fetch = mock.fn(async (_url: string, options: RequestInit) => {
        // Verify the body was sent
        assert.ok(options?.body);
        return {
          ok: true,
          status: 201,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => mockResponse
        };
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items',
        method: 'POST',
        body: { name: 'New Item', price: 100 }
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeHttpRequest(config, context);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.statusCode, 201);
    });

    it('should resolve variables in URL', async () => {
      let capturedUrl = '';

      global.fetch = mock.fn(async (url: string) => {
        capturedUrl = url;
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({})
        };
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items/{{$.itemId}}',
        method: 'GET'
      };

      const context: ExpressionContext = {
        variables: { itemId: '999' },
        stepOutputs: {},
        input: {}
      };

      await executeHttpRequest(config, context);

      assert.strictEqual(capturedUrl, 'https://api.example.com/items/999');
    });

    it('should resolve variables in body', async () => {
      let capturedBody: unknown;

      global.fetch = mock.fn(async (_url: string, options: RequestInit) => {
        capturedBody = JSON.parse(options?.body as string);
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({})
        };
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items',
        method: 'POST',
        body: {
          customerId: '{{$.customerId}}',
          amount: '{{$.amount}}'
        }
      };

      const context: ExpressionContext = {
        variables: { customerId: 'CUST-123', amount: 500 },
        stepOutputs: {},
        input: {}
      };

      await executeHttpRequest(config, context);

      assert.deepStrictEqual(capturedBody, {
        customerId: 'CUST-123',
        amount: 500 // Numbers are preserved when not in template string
      });
    });

    it('should include custom headers', async () => {
      let capturedHeaders: Record<string, string> = {};

      global.fetch = mock.fn(async (_url: string, options: RequestInit) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({})
        };
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items',
        method: 'GET',
        headers: {
          'X-Custom-Header': 'custom-value',
          'X-API-Key': '{{$.apiKey}}'
        }
      };

      const context: ExpressionContext = {
        variables: { apiKey: 'secret-key' },
        stepOutputs: {},
        input: {}
      };

      await executeHttpRequest(config, context);

      assert.strictEqual(capturedHeaders['X-Custom-Header'], 'custom-value');
      assert.strictEqual(capturedHeaders['X-API-Key'], 'secret-key');
    });

    it('should handle authentication', async () => {
      let capturedHeaders: Record<string, string> = {};

      global.fetch = mock.fn(async (_url: string, options: RequestInit) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({})
        };
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items',
        method: 'GET',
        auth: {
          type: 'bearer',
          token: 'my-bearer-token'
        }
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      await executeHttpRequest(config, context);

      assert.strictEqual(
        capturedHeaders['Authorization'],
        'Bearer my-bearer-token'
      );
    });

    it('should handle API key authentication', async () => {
      let capturedHeaders: Record<string, string> = {};

      global.fetch = mock.fn(async (_url: string, options: RequestInit) => {
        capturedHeaders = options?.headers as Record<string, string>;
        return {
          ok: true,
          status: 200,
          headers: new Map([['content-type', 'application/json']]),
          json: async () => ({})
        };
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items',
        method: 'GET',
        auth: {
          type: 'api-key',
          headerName: 'X-API-Key',
          apiKey: 'my-api-key'
        }
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      await executeHttpRequest(config, context);

      assert.strictEqual(capturedHeaders['X-API-Key'], 'my-api-key');
    });

    it('should handle HTTP errors', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ error: 'Item not found' })
      })) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items/999',
        method: 'GET'
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeHttpRequest(config, context);

      assert.strictEqual(result.success, false);
      assert.strictEqual(result.statusCode, 404);
      assert.ok(result.error);
    });

    it('should handle valid status codes configuration', async () => {
      global.fetch = mock.fn(async () => ({
        ok: false,
        status: 404,
        headers: new Map([['content-type', 'application/json']]),
        json: async () => ({ notFound: true })
      })) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items/999',
        method: 'GET',
        validateStatus: [200, 404] // 404 is acceptable
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeHttpRequest(config, context);

      // Should succeed because 404 is in validateStatus
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.statusCode, 404);
    });

    it('should handle network errors', async () => {
      global.fetch = mock.fn(async () => {
        throw new Error('Network error');
      }) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/items',
        method: 'GET'
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeHttpRequest(config, context);

      assert.strictEqual(result.success, false);
      assert.ok(result.error);
      assert.ok(result.error?.message.includes('Network error'));
    });

    it('should handle text response', async () => {
      global.fetch = mock.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Map([['content-type', 'text/plain']]),
        text: async () => 'Plain text response'
      })) as unknown as typeof fetch;

      const config: HttpExecutorConfig = {
        url: 'https://api.example.com/text',
        method: 'GET'
      };

      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = await executeHttpRequest(config, context);

      assert.strictEqual(result.success, true);
      assert.strictEqual(result.data, 'Plain text response');
    });
  });
});

