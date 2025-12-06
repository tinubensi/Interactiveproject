/**
 * Jest setup file for integration tests
 */

import { ServiceConfig, getServiceUrls } from './utils/config';

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidUUID(): R;
      toHaveStatus(status: number): R;
    }
  }
}

// Custom matchers
expect.extend({
  toBeValidUUID(received: string) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const pass = uuidRegex.test(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be a valid UUID`
          : `expected ${received} to be a valid UUID`,
    };
  },
  toHaveStatus(received: { status: number }, expected: number) {
    const pass = received.status === expected;
    return {
      pass,
      message: () =>
        pass
          ? `expected response not to have status ${expected}`
          : `expected response to have status ${expected}, but got ${received.status}`,
    };
  },
});

// Global test configuration
beforeAll(async () => {
  console.log('\n🧪 Starting integration tests...');
  console.log('Service URLs:', getServiceUrls());
});

afterAll(async () => {
  console.log('\n✅ Integration tests completed');
});

// Set reasonable timeouts
jest.setTimeout(30000);

// Suppress console during tests (optional)
if (process.env.SUPPRESS_CONSOLE === 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
}

