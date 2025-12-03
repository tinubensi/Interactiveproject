"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const node_assert_1 = __importDefault(require("node:assert"));
const expressionResolver_1 = require("../lib/engine/expressionResolver");
(0, node_test_1.describe)('Expression Resolver', () => {
    (0, node_test_1.describe)('resolveValue', () => {
        (0, node_test_1.it)('should resolve simple variable path', () => {
            const context = {
                variables: { name: 'John', age: 30 },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.name', context), 'John');
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.age', context), 30);
        });
        (0, node_test_1.it)('should resolve nested variable path', () => {
            const context = {
                variables: {
                    customer: {
                        address: {
                            city: 'Dubai',
                            country: 'UAE'
                        }
                    }
                },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.customer.address.city', context), 'Dubai');
        });
        (0, node_test_1.it)('should resolve array access', () => {
            const context = {
                variables: {
                    items: [
                        { name: 'Item 1' },
                        { name: 'Item 2' },
                        { name: 'Item 3' }
                    ]
                },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.items[0].name', context), 'Item 1');
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.items[2].name', context), 'Item 3');
        });
        (0, node_test_1.it)('should resolve step output reference', () => {
            const context = {
                variables: {},
                stepOutputs: {
                    'step-1': { result: 'success', data: { id: 123 } }
                },
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('{{steps.step-1.result}}', context), 'success');
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('{{steps.step-1.data.id}}', context), 123);
        });
        (0, node_test_1.it)('should resolve input reference', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: { orderId: 'ORD-123', customerId: 'CUST-456' }
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('{{input.orderId}}', context), 'ORD-123');
        });
        (0, node_test_1.it)('should resolve environment variable', () => {
            process.env.TEST_API_URL = 'https://api.test.com';
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('{{env.TEST_API_URL}}', context), 'https://api.test.com');
            delete process.env.TEST_API_URL;
        });
        (0, node_test_1.it)('should return undefined for non-existent path', () => {
            const context = {
                variables: { name: 'John' },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.nonExistent', context), undefined);
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('$.nested.path.that.doesnt.exist', context), undefined);
        });
        (0, node_test_1.it)('should handle literal values', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('literal string', context), 'literal string');
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveValue)('123', context), '123');
        });
    });
    (0, node_test_1.describe)('resolveTemplate', () => {
        (0, node_test_1.it)('should resolve template with single variable', () => {
            const context = {
                variables: { name: 'John' },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveTemplate)('Hello, {{$.name}}!', context), 'Hello, John!');
        });
        (0, node_test_1.it)('should resolve template with multiple variables', () => {
            const context = {
                variables: { firstName: 'John', lastName: 'Doe' },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveTemplate)('Name: {{$.firstName}} {{$.lastName}}', context), 'Name: John Doe');
        });
        (0, node_test_1.it)('should handle nested object references in template', () => {
            const context = {
                variables: {
                    customer: { name: 'Acme Corp', id: 'CUST-123' }
                },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveTemplate)('Customer {{$.customer.name}} ({{$.customer.id}})', context), 'Customer Acme Corp (CUST-123)');
        });
        (0, node_test_1.it)('should replace undefined values with empty string', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveTemplate)('Value: {{$.missing}}', context), 'Value: ');
        });
    });
    (0, node_test_1.describe)('resolveObject', () => {
        (0, node_test_1.it)('should resolve all string values in object', () => {
            const context = {
                variables: { id: '123', name: 'Test' },
                stepOutputs: {},
                input: {}
            };
            const obj = {
                customerId: '{{$.id}}',
                customerName: '{{$.name}}',
                static: 'unchanged'
            };
            const result = (0, expressionResolver_1.resolveObject)(obj, context);
            node_assert_1.default.strictEqual(result.customerId, '123');
            node_assert_1.default.strictEqual(result.customerName, 'Test');
            node_assert_1.default.strictEqual(result.static, 'unchanged');
        });
        (0, node_test_1.it)('should resolve nested objects', () => {
            const context = {
                variables: { city: 'Dubai', country: 'UAE' },
                stepOutputs: {},
                input: {}
            };
            const obj = {
                address: {
                    city: '{{$.city}}',
                    country: '{{$.country}}'
                }
            };
            const result = (0, expressionResolver_1.resolveObject)(obj, context);
            node_assert_1.default.strictEqual(result.address.city, 'Dubai');
            node_assert_1.default.strictEqual(result.address.country, 'UAE');
        });
        (0, node_test_1.it)('should resolve arrays', () => {
            const context = {
                variables: { tag1: 'urgent', tag2: 'important' },
                stepOutputs: {},
                input: {}
            };
            const obj = {
                tags: ['{{$.tag1}}', '{{$.tag2}}', 'static']
            };
            const result = (0, expressionResolver_1.resolveObject)(obj, context);
            node_assert_1.default.deepStrictEqual(result.tags, ['urgent', 'important', 'static']);
        });
    });
    (0, node_test_1.describe)('Built-in Functions', () => {
        (0, node_test_1.it)('should resolve fn.now()', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = (0, expressionResolver_1.resolveValue)('{{fn.now()}}', context);
            node_assert_1.default.ok(typeof result === 'string');
            node_assert_1.default.ok(!isNaN(Date.parse(result)));
        });
        (0, node_test_1.it)('should resolve fn.uuid()', () => {
            const context = {
                variables: {},
                stepOutputs: {},
                input: {}
            };
            const result = (0, expressionResolver_1.resolveValue)('{{fn.uuid()}}', context);
            node_assert_1.default.ok(typeof result === 'string');
            node_assert_1.default.ok(result.length > 0);
            // UUID format check
            node_assert_1.default.ok(/^[0-9a-f-]+$/i.test(result));
        });
        (0, node_test_1.it)('should resolve fn.upper()', () => {
            const context = {
                variables: { text: 'hello world' },
                stepOutputs: {},
                input: {}
            };
            const result = (0, expressionResolver_1.resolveExpression)('{{fn.upper($.text)}}', context);
            node_assert_1.default.strictEqual(result, 'HELLO WORLD');
        });
        (0, node_test_1.it)('should resolve fn.lower()', () => {
            const context = {
                variables: { text: 'HELLO WORLD' },
                stepOutputs: {},
                input: {}
            };
            const result = (0, expressionResolver_1.resolveExpression)('{{fn.lower($.text)}}', context);
            node_assert_1.default.strictEqual(result, 'hello world');
        });
        (0, node_test_1.it)('should resolve fn.trim()', () => {
            const context = {
                variables: { text: '  hello world  ' },
                stepOutputs: {},
                input: {}
            };
            const result = (0, expressionResolver_1.resolveExpression)('{{fn.trim($.text)}}', context);
            node_assert_1.default.strictEqual(result, 'hello world');
        });
        (0, node_test_1.it)('should resolve fn.length()', () => {
            const context = {
                variables: {
                    text: 'hello',
                    items: [1, 2, 3, 4, 5]
                },
                stepOutputs: {},
                input: {}
            };
            const textLength = (0, expressionResolver_1.resolveExpression)('{{fn.length($.text)}}', context);
            const itemsLength = (0, expressionResolver_1.resolveExpression)('{{fn.length($.items)}}', context);
            node_assert_1.default.strictEqual(textLength, 5);
            node_assert_1.default.strictEqual(itemsLength, 5);
        });
        (0, node_test_1.it)('should resolve fn.concat()', () => {
            const context = {
                variables: { first: 'Hello', second: 'World' },
                stepOutputs: {},
                input: {}
            };
            const result = (0, expressionResolver_1.resolveExpression)('{{fn.concat($.first, " ", $.second)}}', context);
            node_assert_1.default.strictEqual(result, 'Hello World');
        });
        (0, node_test_1.it)('should resolve fn.default() for undefined values', () => {
            const context = {
                variables: { existing: 'value' },
                stepOutputs: {},
                input: {}
            };
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveExpression)('{{fn.default($.missing, "fallback")}}', context), 'fallback');
            node_assert_1.default.strictEqual((0, expressionResolver_1.resolveExpression)('{{fn.default($.existing, "fallback")}}', context), 'value');
        });
    });
    (0, node_test_1.describe)('BuiltInFunctions utility', () => {
        (0, node_test_1.it)('should have now function that returns ISO string', () => {
            const result = expressionResolver_1.BuiltInFunctions.now();
            node_assert_1.default.ok(!isNaN(Date.parse(result)));
        });
        (0, node_test_1.it)('should have today function that returns date string', () => {
            const result = expressionResolver_1.BuiltInFunctions.today();
            node_assert_1.default.ok(/^\d{4}-\d{2}-\d{2}$/.test(result));
        });
        (0, node_test_1.it)('should have uuid function', () => {
            const result = expressionResolver_1.BuiltInFunctions.uuid();
            node_assert_1.default.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result));
        });
        (0, node_test_1.it)('should have randomInt function', () => {
            const result = expressionResolver_1.BuiltInFunctions.randomInt(1, 10);
            node_assert_1.default.ok(result >= 1 && result <= 10);
        });
    });
});
//# sourceMappingURL=expressionResolver.test.js.map