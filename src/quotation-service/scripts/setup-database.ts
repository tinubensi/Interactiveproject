/**
 * Database Setup Script
 * Creates Cosmos DB containers for Quotation Service
 */

import { cosmosService } from '../src/services/cosmosService';

async function setup() {
  try {
    console.log('Starting database setup for Quotation Service...');

    // Initialize database and containers
    await cosmosService.initialize();
    console.log('✓ Database and containers created');

    console.log('\n✅ Database setup completed successfully');
    console.log('\nContainers created:');
    console.log('  - quotations (partitionKey: /leadId)');
    console.log('  - quotationPlans (partitionKey: /quotationId)');
    console.log('  - revisions (partitionKey: /quotationId)');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setup();


