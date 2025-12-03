"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const httpExecutor_1 = require("../lib/executors/httpExecutor");
(0, node_test_1.describe)('HTTP Executor', () => {
    const originalFetch = global.fetch;
    (0, node_test_1.beforeEach)(() => {
        // Reset fetch mock before each test
    });
    (0, node_test_1.afterEach)(() => {
        // Restore original fetch
        global.fetch = originalFetch;
    });
    (0, node_test_1.describe)('executeHttpRequest', () => {
        (0, node_test_1.it)('should make GET request successfully', async () => {
            const mockResponse = { id: 123, name: 'Test' };
            global.fetch = node_test_1.mock.fn(async () => ({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => mockResponse
            }));
            const config = {
                url: 'https://api.example.com/items/123',
                method: 'GET'
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.deepStrictEqual(result.success, true);
            node_assert_1.default.deepStrictEqual(result.data, mockResponse);
            node_assert_1.default.strictEqual(result.statusCode, 200);
        });
        (0, node_test_1.it)('should make POST request with body', async () => {
            const mockResponse = { id: 456, created: true };
            global.fetch = node_test_1.mock.fn(async (_url, options) => {
                // Verify the body was sent
                node_assert_1.default.ok(options?.body);
                return {
                    ok: true,
                    status: 201,
                    headers: new Map([['content-type', 'application/json']]),
                    json: async () => mockResponse
                };
            });
            const config = {
                url: 'https://api.example.com/items',
                method: 'POST',
                body: { name: 'New Item', price: 100 }
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.statusCode, 201);
        });
        (0, node_test_1.it)('should resolve variables in URL', async () => {
            let capturedUrl = '';
            global.fetch = node_test_1.mock.fn(async (url) => {
                capturedUrl = url;
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]),
                    json: async () => ({})
                };
            });
            const config = {
                url: 'https://api.example.com/items/{{$.itemId}}',
                method: 'GET'
            };
            const context = {
                variables: { itemId: '999' },
                stepOutputs: {},
                input: {}
            };
            await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(capturedUrl, 'https://api.example.com/items/999');
        });
        (0, node_test_1.it)('should resolve variables in body', async () => {
            let capturedBody;
            global.fetch = node_test_1.mock.fn(async (_url, options) => {
                capturedBody = JSON.parse(options?.body);
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]),
                    json: async () => ({})
                };
            });
            const config = {
                url: 'https://api.example.com/items',
                method: 'POST',
                body: {
                    customerId: '{{$.customerId}}',
                    amount: '{{$.amount}}'
                }
            };
            const context = {
                variables: { customerId: 'CUST-123', amount: 500 },
                stepOutputs: {},
                input: {}
            };
            await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.deepStrictEqual(capturedBody, {
                customerId: 'CUST-123',
                amount: 500 // Numbers are preserved when not in template string
            });
        });
        (0, node_test_1.it)('should include custom headers', async () => {
            let capturedHeaders = {};
            global.fetch = node_test_1.mock.fn(async (_url, options) => {
                capturedHeaders = options?.headers;
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]),
                    json: async () => ({})
                };
            });
            const config = {
                url: 'https://api.example.com/items',
                method: 'GET',
                headers: {
                    'X-Custom-Header': 'custom-value',
                    'X-API-Key': '{{$.apiKey}}'
                }
            };
            const context = {
                variables: { apiKey: 'secret-key' },
                stepOutputs: {},
                input: {}
            };
            await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(capturedHeaders['X-Custom-Header'], 'custom-value');
            node_assert_1.default.strictEqual(capturedHeaders['X-API-Key'], 'secret-key');
        });
        (0, node_test_1.it)('should handle authentication', async () => {
            let capturedHeaders = {};
            global.fetch = node_test_1.mock.fn(async (_url, options) => {
                capturedHeaders = options?.headers;
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]),
                    json: async () => ({})
                };
            });
            const config = {
                url: 'https://api.example.com/items',
                method: 'GET',
                auth: {
                    type: 'bearer',
                    token: 'my-bearer-token'
                }
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(capturedHeaders['Authorization'], 'Bearer my-bearer-token');
        });
        (0, node_test_1.it)('should handle API key authentication', async () => {
            let capturedHeaders = {};
            global.fetch = node_test_1.mock.fn(async (_url, options) => {
                capturedHeaders = options?.headers;
                return {
                    ok: true,
                    status: 200,
                    headers: new Map([['content-type', 'application/json']]),
                    json: async () => ({})
                };
            });
            const config = {
                url: 'https://api.example.com/items',
                method: 'GET',
                auth: {
                    type: 'api-key',
                    headerName: 'X-API-Key',
                    apiKey: 'my-api-key'
                }
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(capturedHeaders['X-API-Key'], 'my-api-key');
        });
        (0, node_test_1.it)('should handle HTTP errors', async () => {
            global.fetch = node_test_1.mock.fn(async () => ({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ error: 'Item not found' })
            }));
            const config = {
                url: 'https://api.example.com/items/999',
                method: 'GET'
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.strictEqual(result.statusCode, 404);
            node_assert_1.default.ok(result.error);
        });
        (0, node_test_1.it)('should handle valid status codes configuration', async () => {
            global.fetch = node_test_1.mock.fn(async () => ({
                ok: false,
                status: 404,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ notFound: true })
            }));
            const config = {
                url: 'https://api.example.com/items/999',
                method: 'GET',
                validateStatus: [200, 404] // 404 is acceptable
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            // Should succeed because 404 is in validateStatus
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.statusCode, 404);
        });
        (0, node_test_1.it)('should handle network errors', async () => {
            global.fetch = node_test_1.mock.fn(async () => {
                throw new Error('Network error');
            });
            const config = {
                url: 'https://api.example.com/items',
                method: 'GET'
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(result.success, false);
            node_assert_1.default.ok(result.error);
            node_assert_1.default.ok(result.error?.message.includes('Network error'));
        });
        (0, node_test_1.it)('should handle text response', async () => {
            global.fetch = node_test_1.mock.fn(async () => ({
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'text/plain']]),
                text: async () => 'Plain text response'
            }));
            const config = {
                url: 'https://api.example.com/text',
                method: 'GET'
            };
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = await (0, httpExecutor_1.executeHttpRequest)(config, context);
            node_assert_1.default.strictEqual(result.success, true);
            node_assert_1.default.strictEqual(result.data, 'Plain text response');
        });
    });
});
//# sourceMappingURL=httpExecutor.test.js.map