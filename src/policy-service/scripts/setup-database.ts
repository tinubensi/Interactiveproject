/**
 * Database Setup Script
 * Creates Cosmos DB containers for Policy Service
 */

import { cosmosService } from '../src/services/cosmosService';

async function setup() {
  try {
    console.log('Starting database setup for Policy Service...');

    await cosmosService.initialize();
    console.log('✓ Database and containers created');

    console.log('\n✅ Database setup completed successfully');
    console.log('\nContainers created:');
    console.log('  - policyRequests (partitionKey: /quotationId)');
    console.log('  - policies (partitionKey: /customerId)');
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setup();


