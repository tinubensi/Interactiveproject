/**
 * Database Setup Script
 * Initializes Cosmos DB containers and seeds data
 */

import { cosmosService } from '../src/services/cosmosService';
import { metadataService } from '../src/services/metadataService';

async function setupDatabase() {
  console.log('Starting database setup...');

  try {
    // Initialize Cosmos DB
    console.log('\n1. Initializing Cosmos DB containers...');
    await cosmosService.initialize();
    console.log('✓ Cosmos DB containers created');

    // Seed stages
    console.log('\n2. Seeding stages...');
    await cosmosService.seedStages();
    console.log('✓ Stages seeded');

    // Initialize metadata container
    console.log('\n3. Initializing metadata container...');
    await metadataService.initialize();
    console.log('✓ Metadata container created');

    // Seed all metadata
    console.log('\n4. Seeding metadata...');
    await metadataService.seedAllMetadata();
    console.log('✓ Metadata seeded');

    console.log('\n✅ Database setup completed successfully!');
    console.log('\nSetup Summary:');
    console.log('- Containers: leads, timelines, stages, metadata');
    console.log('- Stages: 8 stages seeded');
    console.log('- Pet Types: 2 (Dog, Cat)');
    console.log('- Breed Types: 6');
    console.log('- Breeds: 17');
    console.log('- Gender Types: 2');
    console.log('- Emirates: 7');

  } catch (error) {
    console.error('\n❌ Database setup failed:', error);
    throw error;
  }
}

// Run setup
setupDatabase()
  .then(() => {
    console.log('\n✓ Setup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Setup script failed:', error);
    process.exit(1);
  });


