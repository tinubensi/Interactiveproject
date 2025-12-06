/**
 * Test customer fixtures
 */

export interface TestCustomer {
  customerId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    country?: string;
    postalCode?: string;
  };
  emiratesId?: string;
  createdBy?: string;
  status?: string;
}

export const CUSTOMERS: Record<string, TestCustomer> = {
  individual: {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: '+971501234567',
    dateOfBirth: '1985-06-15',
    address: {
      street: '123 Test Street',
      city: 'Dubai',
      state: 'Dubai',
      country: 'UAE',
      postalCode: '12345',
    },
    emiratesId: '784-1985-1234567-1',
  },
  corporate: {
    firstName: 'Acme',
    lastName: 'Corporation',
    email: 'contact@acme.example.com',
    phone: '+971501234568',
    address: {
      street: '456 Business Park',
      city: 'Abu Dhabi',
      state: 'Abu Dhabi',
      country: 'UAE',
      postalCode: '54321',
    },
  },
  minimal: {
    firstName: 'Jane',
    lastName: 'Smith',
    email: 'jane.smith@example.com',
  },
};

/**
 * Generate a unique customer for testing
 */
export function generateCustomer(overrides?: Partial<TestCustomer>): TestCustomer {
  const uniqueId = Date.now().toString(36);
  return {
    firstName: `Test${uniqueId}`,
    lastName: 'Customer',
    email: `test.customer.${uniqueId}@example.com`,
    phone: `+9715012${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
    ...overrides,
  };
}

