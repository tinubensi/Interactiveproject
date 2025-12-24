/**
 * Seed Enhanced Medical Pipeline
 * Run this script to create the enhanced Medical LOB pipeline in the database
 * 
 * Usage: npx ts-node scripts/seedEnhancedPipeline.ts
 */

import { generateEnhancedMedicalPipeline } from '../src/data/seedEnhancedPipeline';
import { validatePipelineDefinition } from '../src/utils/pipelineValidator';
import { initializeDatabase, getPipelinesContainer } from '../src/lib/cosmosClient';

async function main() {
  console.log('===========================================');
  console.log('Enhanced Medical Pipeline Seeding');
  console.log('===========================================\n');

  console.log('Step 1: Generating enhanced Medical pipeline...');
  const pipeline = generateEnhancedMedicalPipeline();
  console.log(`✓ Pipeline generated: ${pipeline.name}`);
  console.log(`  - Pipeline ID: ${pipeline.pipelineId}`);
  console.log(`  - Version: ${pipeline.version}`);
  console.log(`  - Line of Business: ${pipeline.lineOfBusiness}`);
  console.log(`  - Total Steps: ${pipeline.steps.length}\n`);

  console.log('Step 2: Validating pipeline definition...');
  try {
    validatePipelineDefinition(pipeline);
    console.log('✓ Pipeline validation passed\n');
  } catch (error: any) {
    console.error('✗ Pipeline validation failed:', error.message);
    process.exit(1);
  }

  console.log('Step 3: Initializing database...');
  try {
    await initializeDatabase();
    console.log('✓ Database initialized\n');
  } catch (error: any) {
    console.error('✗ Failed to initialize database:', error.message);
    process.exit(1);
  }

  console.log('Step 4: Seeding to database...');
  let createdPipeline;
  try {
    const container = getPipelinesContainer();
    const { resource } = await container.items.create(pipeline);
    createdPipeline = resource;
    console.log('✓ Pipeline created successfully in database\n');
  } catch (error: any) {
    console.error('✗ Failed to create pipeline:', error.message);
    if (error.code === 409) {
      console.error('  (Pipeline may already exist - check database)');
    }
    process.exit(1);
  }

  if (!createdPipeline) {
    console.error('✗ Pipeline was not created properly');
    process.exit(1);
  }

  console.log('===========================================');
  console.log('✓ Enhanced Medical pipeline seeded successfully!');
  console.log('===========================================\n');
  console.log('Pipeline Details:');
  console.log(`  ID: ${createdPipeline.pipelineId}`);
  console.log(`  Name: ${createdPipeline.name}`);
  console.log(`  Version: ${createdPipeline.version}`);
  console.log(`  Status: ${createdPipeline.status}`);
  console.log(`  Entry Step: ${createdPipeline.entryStepId}\n`);

  console.log('Next Steps:');
  console.log('  1. Deploy service handlers (quotation-gen, quotation, policy)');
  console.log('  2. Setup Event Grid subscriptions');
  console.log('  3. Test with a new lead creation\n');
}

main()
  .then(() => {
    console.log('Script completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed with error:', error);
    process.exit(1);
  });

