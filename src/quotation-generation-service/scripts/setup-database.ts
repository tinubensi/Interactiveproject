/**
 * Database Setup Script
 * Creates Cosmos DB containers and seeds initial data
 */

import { cosmosService } from '../src/services/cosmosService';
import { STATIC_VENDORS } from '../src/data/staticPlans';

async function setup() {
  try {
    console.log('Starting database setup for Quotation Generation Service...');

    // Initialize database and containers
    await cosmosService.initialize();
    console.log('✓ Database and containers created');

    // Seed vendors
    await cosmosService.seedVendors(STATIC_VENDORS);
    console.log(`✓ Seeded ${STATIC_VENDORS.length} vendors`);

    console.log('\n✅ Database setup completed successfully');
    console.log('\nContainers created:');
    console.log('  - fetchRequests (partitionKey: /leadId)');
    console.log('  - plans (partitionKey: /leadId)');
    console.log('  - planFilters (partitionKey: /leadId)');
    console.log('  - planComparisons (partitionKey: /leadId)');
    console.log('  - vendors (partitionKey: /lineOfBusiness)');
    console.log('\nVendors seeded:');
    STATIC_VENDORS.forEach(v => console.log(`  - ${v.name} (${v.code}) - ${v.lineOfBusiness}`));
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  }
}

setup();


