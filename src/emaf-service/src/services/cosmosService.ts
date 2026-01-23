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

  // ==================== EMAF TEMPLATE OPERATIONS ====================

  /**
   * Create new EMAF template
   */
  async createEmafTemplate(template: EmafTemplate): Promise<EmafTemplate> {
    await this.initialize();
    
    const { resource } = await this.templatesContainer!.items.create(template);
    return resource as EmafTemplate;
  }

  /**
   * Get EMAF template by vendor ID
   */
  async getEmafTemplateByVendor(vendorId: string): Promise<EmafTemplate | null> {
    await this.initialize();

    const query = {
      query: 'SELECT * FROM c WHERE c.vendorId = @vendorId AND c.status != @archivedStatus AND c.isDeleted != true ORDER BY c.version DESC',
      parameters: [
        { name: '@vendorId', value: vendorId },
        { name: '@archivedStatus', value: 'archived' }
      ]
    };

    const { resources } = await this.templatesContainer!.items.query(query).fetchAll();
    
    return resources.length > 0 ? (resources[0] as EmafTemplate) : null;
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
   * Update EMAF template
   */
  async updateEmafTemplate(
    id: string,
    vendorId: string,
    updates: Partial<EmafTemplate>
  ): Promise<EmafTemplate> {
    await this.initialize();

    const existing = await this.getEmafTemplateById(id, vendorId);
    if (!existing) {
      throw new Error(`EMAF template not found: ${id}`);
    }

    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change
      vendorId: existing.vendorId, // Prevent partition key change
      updatedAt: new Date(),
    };

    const { resource } = await this.templatesContainer!.item(id, vendorId).replace(updated);
    return resource as EmafTemplate;
  }

  /**
   * List all EMAF templates
   */
  async listEmafTemplates(options?: {
    lineOfBusiness?: string;
    status?: string;
    limit?: number;
  }): Promise<EmafTemplate[]> {
    await this.initialize();

    let queryText = 'SELECT * FROM c WHERE c.isDeleted != true';
    const parameters: any[] = [];

    if (options?.lineOfBusiness) {
      queryText += ' AND c.lineOfBusiness = @lob';
      parameters.push({ name: '@lob', value: options.lineOfBusiness });
    }

    if (options?.status) {
      queryText += ' AND c.status = @status';
      parameters.push({ name: '@status', value: options.status });
    }

    queryText += ' ORDER BY c.createdAt DESC';

    const query = { query: queryText, parameters };
    const { resources } = await this.templatesContainer!.items.query(query).fetchAll();

    const results = resources as EmafTemplate[];
    return options?.limit ? results.slice(0, options.limit) : results;
  }

  /**
   * Soft delete EMAF template
   */
  async deleteEmafTemplate(id: string, vendorId: string): Promise<void> {
    await this.initialize();

    await this.updateEmafTemplate(id, vendorId, {
      isDeleted: true,
      status: 'archived',
    });
  }

  // ==================== EMAF SUBMISSION OPERATIONS ====================

  /**
   * Create new EMAF submission
   */
  async createSubmission(submission: EmafSubmission): Promise<EmafSubmission> {
    await this.initialize();

    const { resource } = await this.submissionsContainer!.items.create(submission);
    return resource as EmafSubmission;
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
   * Get submission by lead and quotation
   */
  async getSubmissionByLeadAndQuotation(
    leadId: string,
    quotationId: string
  ): Promise<EmafSubmission | null> {
    await this.initialize();

    const query = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId AND c.quotationId = @quotationId',
      parameters: [
        { name: '@leadId', value: leadId },
        { name: '@quotationId', value: quotationId }
      ]
    };

    const { resources } = await this.submissionsContainer!.items.query(query).fetchAll();
    
    return resources.length > 0 ? (resources[0] as EmafSubmission) : null;
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
      id: existing.id, // Prevent ID change
      leadId: existing.leadId, // Prevent partition key change
      updatedAt: new Date(),
    };

    const { resource } = await this.submissionsContainer!
      .item(submissionId, leadId)
      .replace(updated);
    
    return resource as EmafSubmission;
  }

  /**
   * List pending submissions for approval
   */
  async listPendingSubmissions(limit: number = 50): Promise<EmafSubmission[]> {
    try {
      await this.initialize();

      console.log(`[CosmosService] Querying pending submissions with status: pending_approval, limit: ${limit}`);
      console.log(`[CosmosService] Database: ${this.database?.id}, Container: ${this.submissionsContainer?.id}`);

      const query = {
        query: 'SELECT * FROM c WHERE c.status = @status ORDER BY c.submittedAt DESC OFFSET 0 LIMIT @limit',
        parameters: [
          { name: '@status', value: 'pending_approval' },
          { name: '@limit', value: limit }
        ]
      };

      const { resources } = await this.submissionsContainer!.items.query(query).fetchAll();
      console.log(`[CosmosService] Query returned ${resources.length} submissions`);
      
      return resources as EmafSubmission[];
    } catch (error: any) {
      console.error('[CosmosService] Error in listPendingSubmissions:', error);
      console.error('[CosmosService] Error details:', error.message);
      throw error;
    }
  }

  /**
   * List submissions by status
   */
  async listSubmissionsByStatus(status: string, limit: number = 50): Promise<EmafSubmission[]> {
    await this.initialize();

    const query = {
      query: 'SELECT * FROM c WHERE c.status = @status ORDER BY c.updatedAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@status', value: status },
        { name: '@limit', value: limit }
      ]
    };

    const { resources } = await this.submissionsContainer!.items.query(query).fetchAll();
    return resources as EmafSubmission[];
  }

  /**
   * List submissions by vendor
   */
  async listSubmissionsByVendor(vendorId: string, limit: number = 50): Promise<EmafSubmission[]> {
    await this.initialize();

    const query = {
      query: 'SELECT * FROM c WHERE c.vendorId = @vendorId ORDER BY c.createdAt DESC OFFSET 0 LIMIT @limit',
      parameters: [
        { name: '@vendorId', value: vendorId },
        { name: '@limit', value: limit }
      ]
    };

    const { resources } = await this.submissionsContainer!.items.query(query).fetchAll();
    return resources as EmafSubmission[];
  }

  /**
   * Get submissions by lead ID
   */
  async getSubmissionsByLead(leadId: string): Promise<EmafSubmission[]> {
    await this.initialize();

    const query = {
      query: 'SELECT * FROM c WHERE c.leadId = @leadId ORDER BY c.createdAt DESC',
      parameters: [
        { name: '@leadId', value: leadId }
      ]
    };

    const { resources } = await this.submissionsContainer!.items.query(query).fetchAll();
    return resources as EmafSubmission[];
  }

  /**
   * Get submission by ID (cross-partition query)
   * Used when we only have the submission ID (token) and not the leadId
   */
  async getSubmissionById(submissionId: string): Promise<EmafSubmission | null> {
    await this.initialize();

    const query = {
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [
        { name: '@id', value: submissionId }
      ]
    };

    // Cross-partition query since we don't have partition key
    // Note: Cosmos DB v4 SDK enables cross-partition queries by default
    const { resources } = await this.submissionsContainer!.items.query(query).fetchAll();
    
    return resources && resources.length > 0 ? resources[0] as EmafSubmission : null;
  }
}

export const cosmosService = new CosmosService();
