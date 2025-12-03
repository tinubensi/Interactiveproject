import { CosmosClient, Container, Database } from '@azure/cosmos';
import { Customer, OTPRecord } from '../types/customer';

const CUSTOMER_CONTAINER = 'customers';
const OTP_CONTAINER = 'otps';

class CosmosService {
  private client: CosmosClient;
  private database: Database | null = null;
  private customerContainer: Container | null = null;
  private otpContainer: Container | null = null;

  constructor() {
    // Default values for Cosmos DB Emulator (local development)
    const DEFAULT_ENDPOINT = 'https://localhost:8081';
    const DEFAULT_KEY = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';
    
    // Read environment variables at runtime (Azure Functions loads from local.settings.json)
    // Read directly from process.env like the debug endpoint does
    let endpoint = process.env.COSMOS_DB_ENDPOINT || '';
    let key = process.env.COSMOS_DB_KEY || '';
    
    // Use defaults if env vars are not set or empty
    if (!endpoint || endpoint.trim() === '') {
      endpoint = DEFAULT_ENDPOINT;
    }
    if (!key || key.trim() === '') {
      key = DEFAULT_KEY;
    }
    
    // Log for debugging (remove in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('CosmosService constructor - Endpoint:', endpoint ? 'SET' : 'NOT SET', 'Key:', key ? `SET (length: ${key.length})` : 'NOT SET');
    }
    
    // Validate required environment variables with detailed error
    if (!endpoint || endpoint.trim() === '') {
      const availableKeys = Object.keys(process.env).filter(k => k.includes('COSMOS') || k.includes('cosmos'));
      const errorMsg = `COSMOS_DB_ENDPOINT is not set. Current value: "${endpoint}". Available env keys: ${availableKeys.join(', ') || 'none'}`;
      throw new Error(errorMsg);
    }
    if (!key || key.trim() === '') {
      const availableKeys = Object.keys(process.env).filter(k => k.includes('COSMOS') || k.includes('cosmos'));
      const errorMsg = `COSMOS_DB_KEY is not set. Key length: ${key ? key.length : 0}. Available env keys: ${availableKeys.join(', ') || 'none'}. All env keys with COSMOS: ${JSON.stringify(Object.keys(process.env).filter(k => k.toLowerCase().includes('cosmos')))}`;
      throw new Error(errorMsg);
    }

    // For local development with Cosmos DB Emulator, disable SSL verification
    const connectionOptions: any = {
      endpoint: endpoint.trim(),
      key: key.trim(),
    };

    // Disable SSL verification for local emulator (development only)
    if ((process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) && endpoint.includes('localhost')) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Validate key is not empty before passing to CosmosClient
    if (!connectionOptions.key || connectionOptions.key.length === 0) {
      throw new Error(`CosmosClient key is empty. Endpoint: ${connectionOptions.endpoint}, Key length: ${connectionOptions.key ? connectionOptions.key.length : 0}`);
    }

    try {
      this.client = new CosmosClient(connectionOptions);
    } catch (error: any) {
      // Wrap CosmosClient errors with more context
      throw new Error(`Failed to create CosmosClient: ${error.message}. Endpoint: ${connectionOptions.endpoint}, Key length: ${connectionOptions.key ? connectionOptions.key.length : 0}`);
    }
  }

  private async getDatabase(): Promise<Database> {
    if (!this.database) {
      const dbName = process.env.COSMOS_DB_DATABASE || 'CustomerDB';
      const { database } = await this.client.databases.createIfNotExists({
        id: dbName,
      });
      this.database = database;
    }
    return this.database;
  }

  private async getCustomerContainer(): Promise<Container> {
    if (!this.customerContainer) {
      const database = await this.getDatabase();
      const { container } = await database.containers.createIfNotExists({
        id: CUSTOMER_CONTAINER,
        partitionKey: { paths: ['/id'] },
      });
      this.customerContainer = container;
    }
    return this.customerContainer;
  }

  private async getOTPContainer(): Promise<Container> {
    if (!this.otpContainer) {
      const database = await this.getDatabase();
      const { container } = await database.containers.createIfNotExists({
        id: OTP_CONTAINER,
        partitionKey: { paths: ['/email'] },
      });
      this.otpContainer = container;
    }
    return this.otpContainer;
  }

  async createCustomer(customer: Customer): Promise<Customer> {
    const container = await this.getCustomerContainer();
    const { resource } = await container.items.create(customer);
    return resource as Customer;
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    const container = await this.getCustomerContainer();
    try {
      const { resource } = await container.item(id, id).read();
      return resource as Customer;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    const container = await this.getCustomerContainer();
    const query = `SELECT * FROM c WHERE c.email = @email OR c.email1 = @email OR c.email2 = @email`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [{ name: '@email', value: email }],
      })
      .fetchAll();
    return resources.length > 0 ? (resources[0] as Customer) : null;
  }

  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    const container = await this.getCustomerContainer();
    const existing = await this.getCustomerById(id);
    if (!existing) {
      throw new Error('Customer not found');
    }
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    const { resource } = await container.item(id, id).replace(updated);
    return resource as Customer;
  }

  async saveOTP(email: string, otp: string, ttlSeconds: number = 300): Promise<OTPRecord> {
    const container = await this.getOTPContainer();
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const otpRecord: OTPRecord = {
      id: `${email}-${Date.now()}`,
      email,
      otp,
      expiresAt,
      createdAt: new Date().toISOString(),
      ttl: ttlSeconds,
    };
    const { resource } = await container.items.create(otpRecord);
    return resource as OTPRecord;
  }

  async getOTP(email: string, otp: string): Promise<OTPRecord | null> {
    const container = await this.getOTPContainer();
    const query = `SELECT * FROM c WHERE c.email = @email AND c.otp = @otp ORDER BY c.createdAt DESC`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: '@email', value: email },
          { name: '@otp', value: otp },
        ],
      })
      .fetchAll();
    
    if (resources.length === 0) {
      return null;
    }

    const record = resources[0] as OTPRecord;
    // Check if expired
    if (record.expiresAt < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return record;
  }

  async deleteOTP(email: string, otp: string): Promise<void> {
    const container = await this.getOTPContainer();
    const query = `SELECT * FROM c WHERE c.email = @email AND c.otp = @otp`;
    const { resources } = await container.items
      .query({
        query,
        parameters: [
          { name: '@email', value: email },
          { name: '@otp', value: otp },
        ],
      })
      .fetchAll();
    
    for (const item of resources) {
      await container.item(item.id, email).delete();
    }
  }

  async queryCustomers(query: string, parameters?: Array<{ name: string; value: any }>): Promise<Customer[]> {
    const container = await this.getCustomerContainer();
    const querySpec = parameters
      ? { query, parameters }
      : { query };
    
    const { resources } = await container.items.query(querySpec).fetchAll();
    return resources as Customer[];
  }
}

// Lazy initialization - only create instance when first accessed
let cosmosServiceInstance: CosmosService | null = null;

function getInstance(): CosmosService {
  if (!cosmosServiceInstance) {
    cosmosServiceInstance = new CosmosService();
  }
  return cosmosServiceInstance;
}

export const cosmosService = {
  // Proxy methods for convenience
  async createCustomer(customer: Customer): Promise<Customer> {
    return getInstance().createCustomer(customer);
  },
  async getCustomerById(id: string): Promise<Customer | null> {
    return getInstance().getCustomerById(id);
  },
  async getCustomerByEmail(email: string): Promise<Customer | null> {
    return getInstance().getCustomerByEmail(email);
  },
  async updateCustomer(id: string, updates: Partial<Customer>): Promise<Customer> {
    return getInstance().updateCustomer(id, updates);
  },
  async queryCustomers(query: string, parameters?: Array<{ name: string; value: any }>): Promise<Customer[]> {
    return getInstance().queryCustomers(query, parameters);
  },
  async saveOTP(email: string, otp: string, ttlSeconds?: number): Promise<OTPRecord> {
    return getInstance().saveOTP(email, otp, ttlSeconds);
  },
  async getOTP(email: string, otp: string): Promise<OTPRecord | null> {
    return getInstance().getOTP(email, otp);
  },
  async deleteOTP(email: string, otp: string): Promise<void> {
    return getInstance().deleteOTP(email, otp);
  },
};

