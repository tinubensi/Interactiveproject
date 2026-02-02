/**
 * Cosmos DB Service for EMAF
 * Implements repository pattern for data access
 */

import { CosmosClient, Container, Database } from '@azure/cosmos';
import { getConfig } from '../config';
import { EmafTemplate, EmafSubmission } from '../models/emafTypes';

class CosmosService {
  private client: CosmosClient | null = null;
  private database: Database | null = null;
  private templatesContainer: Container | null = null;
  private submissionsContainer: Container | null = null;

  /**
   * Initialize Cosmos DB connection
   */
  private async initialize(): Promise<void> {
    if (this.client) return;

    const config = getConfig();
    
    if (!config.cosmos.connectionString) {
      throw new Error('COSMOS_CONNECTION_STRING is not configured');
    }

    this.client = new CosmosClient(config.cosmos.connectionString);
    this.database = this.client.database(config.cosmos.databaseName);
    this.templatesContainer = this.database.container(config.cosmos.templatesContainer);
    this.submissionsContainer = this.database.container(config.cosmos.submissionsContainer);
  }

  /**
   * Get EMAF template by ID
   */
  async getEmafTemplateById(id: string, vendorId: string): Promise<EmafTemplate | null> {
    await this.initialize();

    try {
      const { resource } = await this.templatesContainer!.item(id, vendorId).read();
      return resource as EmafTemplate;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get submission by ID
   */
  async getSubmission(submissionId: string, leadId: string): Promise<EmafSubmission | null> {
    await this.initialize();

    try {
      const { resource } = await this.submissionsContainer!.item(submissionId, leadId).read();
      return resource as EmafSubmission;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Update submission
   */
  async updateSubmission(
    submissionId: string,
    leadId: string,
    updates: Partial<EmafSubmission>
  ): Promise<EmafSubmission> {
    await this.initialize();

    const existing = await this.getSubmission(submissionId, leadId);
    if (!existing) {
      throw new Error(`Submission not found: ${submissionId}`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      leadId: existing.leadId,
      updatedAt: new Date(),
    };

    const { resource } = await this.submissionsContainer!
      .item(submissionId, leadId)
      .replace(updated);
    
    return resource as EmafSubmission;
  }

  /**
   * Get lead by ID from Cosmos DB
   * Note: This assumes leads are stored in a container accessible via the same connection
   * Adjust container name based on your Cosmos DB structure
   */
  async getLeadById(leadId: string, lineOfBusiness: string): Promise<any | null> {
    await this.initialize();

    try {
      // Try to access leads container (adjust container name if different)
      const leadsContainer = this.database!.container('lead-service-db');
      
      const querySpec = {
        query: 'SELECT * FROM c WHERE c.id = @id AND c.lineOfBusiness = @lob',
        parameters: [
          { name: '@id', value: leadId },
          { name: '@lob', value: lineOfBusiness }
        ]
      };

      const { resources } = await leadsContainer.items.query(querySpec).fetchAll();
      
      if (resources && resources.length > 0) {
        return resources[0];
      }
      
      return null;
    } catch (error: any) {
      // If leads container doesn't exist or query fails, return null
      console.error('Error fetching lead from Cosmos DB:', error.message);
      return null;
    }
  }
}

export const cosmosService = new CosmosService();
