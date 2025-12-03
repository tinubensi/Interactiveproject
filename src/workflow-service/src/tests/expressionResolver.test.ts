import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  resolveExpression,
  resolveValue,
  resolveTemplate,
  resolveObject,
  ExpressionContext,
  BuiltInFunctions
} from '../lib/engine/expressionResolver';

describe('Expression Resolver', () => {
  describe('resolveValue', () => {
    it('should resolve simple variable path', () => {
      const context: ExpressionContext = {
        variables: { name: 'John', age: 30 },
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(resolveValue('$.name', context), 'John');
      assert.strictEqual(resolveValue('$.age', context), 30);
    });

    it('should resolve nested variable path', () => {
      const context: ExpressionContext = {
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

      assert.strictEqual(
        resolveValue('$.customer.address.city', context),
        'Dubai'
      );
    });

    it('should resolve array access', () => {
      const context: ExpressionContext = {
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

      assert.strictEqual(resolveValue('$.items[0].name', context), 'Item 1');
      assert.strictEqual(resolveValue('$.items[2].name', context), 'Item 3');
    });

    it('should resolve step output reference', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {
          'step-1': { result: 'success', data: { id: 123 } }
        },
        input: {}
      };

      assert.strictEqual(
        resolveValue('{{steps.step-1.result}}', context),
        'success'
      );
      assert.strictEqual(
        resolveValue('{{steps.step-1.data.id}}', context),
        123
      );
    });

    it('should resolve input reference', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: { orderId: 'ORD-123', customerId: 'CUST-456' }
      };

      assert.strictEqual(
        resolveValue('{{input.orderId}}', context),
        'ORD-123'
      );
    });

    it('should resolve environment variable', () => {
      process.env.TEST_API_URL = 'https://api.test.com';
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(
        resolveValue('{{env.TEST_API_URL}}', context),
        'https://api.test.com'
      );

      delete process.env.TEST_API_URL;
    });

    it('should return undefined for non-existent path', () => {
      const context: ExpressionContext = {
        variables: { name: 'John' },
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(resolveValue('$.nonExistent', context), undefined);
      assert.strictEqual(
        resolveValue('$.nested.path.that.doesnt.exist', context),
        undefined
      );
    });

    it('should handle literal values', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(resolveValue('literal string', context), 'literal string');
      assert.strictEqual(resolveValue('123', context), '123');
    });
  });

  describe('resolveTemplate', () => {
    it('should resolve template with single variable', () => {
      const context: ExpressionContext = {
        variables: { name: 'John' },
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(
        resolveTemplate('Hello, {{$.name}}!', context),
        'Hello, John!'
      );
    });

    it('should resolve template with multiple variables', () => {
      const context: ExpressionContext = {
        variables: { firstName: 'John', lastName: 'Doe' },
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(
        resolveTemplate('Name: {{$.firstName}} {{$.lastName}}', context),
        'Name: John Doe'
      );
    });

    it('should handle nested object references in template', () => {
      const context: ExpressionContext = {
        variables: {
          customer: { name: 'Acme Corp', id: 'CUST-123' }
        },
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(
        resolveTemplate('Customer {{$.customer.name}} ({{$.customer.id}})', context),
        'Customer Acme Corp (CUST-123)'
      );
    });

    it('should replace undefined values with empty string', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(
        resolveTemplate('Value: {{$.missing}}', context),
        'Value: '
      );
    });
  });

  describe('resolveObject', () => {
    it('should resolve all string values in object', () => {
      const context: ExpressionContext = {
        variables: { id: '123', name: 'Test' },
        stepOutputs: {},
        input: {}
      };

      const obj = {
        customerId: '{{$.id}}',
        customerName: '{{$.name}}',
        static: 'unchanged'
      };

      const result = resolveObject(obj, context) as Record<string, unknown>;

      assert.strictEqual(result.customerId, '123');
      assert.strictEqual(result.customerName, 'Test');
      assert.strictEqual(result.static, 'unchanged');
    });

    it('should resolve nested objects', () => {
      const context: ExpressionContext = {
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

      const result = resolveObject(obj, context) as { address: { city: string; country: string } };

      assert.strictEqual(result.address.city, 'Dubai');
      assert.strictEqual(result.address.country, 'UAE');
    });

    it('should resolve arrays', () => {
      const context: ExpressionContext = {
        variables: { tag1: 'urgent', tag2: 'important' },
        stepOutputs: {},
        input: {}
      };

      const obj = {
        tags: ['{{$.tag1}}', '{{$.tag2}}', 'static']
      };

      const result = resolveObject(obj, context) as { tags: string[] };

      assert.deepStrictEqual(result.tags, ['urgent', 'important', 'static']);
    });
  });

  describe('Built-in Functions', () => {
    it('should resolve fn.now()', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = resolveValue('{{fn.now()}}', context);
      assert.ok(typeof result === 'string');
      assert.ok(!isNaN(Date.parse(result as string)));
    });

    it('should resolve fn.uuid()', () => {
      const context: ExpressionContext = {
        variables: {},
        stepOutputs: {},
        input: {}
      };

      const result = resolveValue('{{fn.uuid()}}', context) as string;
      assert.ok(typeof result === 'string');
      assert.ok(result.length > 0);
      // UUID format check
      assert.ok(/^[0-9a-f-]+$/i.test(result));
    });

    it('should resolve fn.upper()', () => {
      const context: ExpressionContext = {
        variables: { text: 'hello world' },
        stepOutputs: {},
        input: {}
      };

      const result = resolveExpression('{{fn.upper($.text)}}', context);
      assert.strictEqual(result, 'HELLO WORLD');
    });

    it('should resolve fn.lower()', () => {
      const context: ExpressionContext = {
        variables: { text: 'HELLO WORLD' },
        stepOutputs: {},
        input: {}
      };

      const result = resolveExpression('{{fn.lower($.text)}}', context);
      assert.strictEqual(result, 'hello world');
    });

    it('should resolve fn.trim()', () => {
      const context: ExpressionContext = {
        variables: { text: '  hello world  ' },
        stepOutputs: {},
        input: {}
      };

      const result = resolveExpression('{{fn.trim($.text)}}', context);
      assert.strictEqual(result, 'hello world');
    });

    it('should resolve fn.length()', () => {
      const context: ExpressionContext = {
        variables: { 
          text: 'hello',
          items: [1, 2, 3, 4, 5]
        },
        stepOutputs: {},
        input: {}
      };

      const textLength = resolveExpression('{{fn.length($.text)}}', context);
      const itemsLength = resolveExpression('{{fn.length($.items)}}', context);
      assert.strictEqual(textLength, 5);
      assert.strictEqual(itemsLength, 5);
    });

    it('should resolve fn.concat()', () => {
      const context: ExpressionContext = {
        variables: { first: 'Hello', second: 'World' },
        stepOutputs: {},
        input: {}
      };

      const result = resolveExpression('{{fn.concat($.first, " ", $.second)}}', context);
      assert.strictEqual(result, 'Hello World');
    });

    it('should resolve fn.default() for undefined values', () => {
      const context: ExpressionContext = {
        variables: { existing: 'value' },
        stepOutputs: {},
        input: {}
      };

      assert.strictEqual(
        resolveExpression('{{fn.default($.missing, "fallback")}}', context),
        'fallback'
      );
      assert.strictEqual(
        resolveExpression('{{fn.default($.existing, "fallback")}}', context),
        'value'
      );
    });
  });

  describe('BuiltInFunctions utility', () => {
    it('should have now function that returns ISO string', () => {
      const result = BuiltInFunctions.now();
      assert.ok(!isNaN(Date.parse(result)));
    });

    it('should have today function that returns date string', () => {
      const result = BuiltInFunctions.today();
      assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(result));
    });

    it('should have uuid function', () => {
      const result = BuiltInFunctions.uuid();
      assert.ok(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result));
    });

    it('should have randomInt function', () => {
      const result = BuiltInFunctions.randomInt(1, 10);
      assert.ok(result >= 1 && result <= 10);
    });
  });
});

