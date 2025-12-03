import { CosmosClient, Database, Container } from '@azure/cosmos';
import { config } from '../config';
import { Document } from '../models/Document';

/**
 * Service for interacting with Azure Cosmos DB
 */
export class CosmosService {
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private container: Container | null = null;

  private getContainer(): Container {
    if (!this.container) {
      this.client = new CosmosClient(config.cosmosDb.connectionString);
      this.database = this.client.database(config.cosmosDb.databaseName);
      this.container = this.database.container(config.cosmosDb.containerName);
    }
    return this.container;
  }

  constructor() {
    // Lazy initialization - don't connect until first use
  }

  /**
   * Create a new document in Cosmos DB
   */
  async createDocument(document: Document): Promise<Document> {
    const { resource } = await this.getContainer().items.create(document);
    if (!resource) {
      throw new Error('Failed to create document');
    }
    return resource as unknown as Document;
  }

  /**
   * Get a document by ID and customerId (partition key)
   */
  async getDocument(documentId: string, customerId: string): Promise<Document | null> {
    try {
      const { resource } = await this.getContainer()
        .item(documentId, customerId)
        .read<Document>();
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * List all documents for a customer (single-partition query)
   */
  async listDocumentsByCustomer(customerId: string): Promise<Document[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.customerId = @customerId',
      parameters: [
        {
          name: '@customerId',
          value: customerId,
        },
      ],
    };

    const { resources } = await this.getContainer().items
      .query<Document>(querySpec, {
        partitionKey: customerId,
      })
      .fetchAll();

    return resources;
  }

  /**
   * List documents by userId and optionally customerId
   */
  async listDocumentsByUser(customerId: string, userId: string): Promise<Document[]> {
    const querySpec = {
      query: 'SELECT * FROM c WHERE c.customerId = @customerId AND c.userId = @userId',
      parameters: [
        {
          name: '@customerId',
          value: customerId,
        },
        {
          name: '@userId',
          value: userId,
        },
      ],
    };

    const { resources } = await this.getContainer().items
      .query<Document>(querySpec, {
        partitionKey: customerId,
      })
      .fetchAll();

    return resources;
  }

  /**
   * Update a document
   */
  async updateDocument(document: Document): Promise<Document> {
    const { resource } = await this.getContainer()
      .item(document.id, document.customerId)
      .replace(document);
    if (!resource) {
      throw new Error('Failed to update document');
    }
    return resource as unknown as Document;
  }

  /**
   * Delete a document by ID and customerId
   */
  async deleteDocument(documentId: string, customerId: string): Promise<void> {
    await this.getContainer().item(documentId, customerId).delete();
  }
}

