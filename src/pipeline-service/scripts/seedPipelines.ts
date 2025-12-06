/**
 * Pipeline Seeder Script
 * Seeds the default Individual Health Insurance pipeline to the database
 * 
 * Usage: npm run seed
 */

import { initializeDatabase, getPipelinesContainer } from '../src/lib/cosmosClient';
import { getSeedData } from '../src/data/seedDefaultPipeline';
import type { PipelineDefinition } from '../src/models/pipeline';

async function seedPipelines(): Promise<void> {
  console.log('🚀 Starting Pipeline Seeder...\n');

  try {
    // Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    // Get seed data
    const { pipeline, message } = getSeedData('system-seeder');
    console.log(`📋 ${message}\n`);

    // Get the pipelines container
    const container = getPipelinesContainer();

    // Check if pipeline already exists
    const query = {
      query: 'SELECT * FROM c WHERE c.lineOfBusiness = @lob AND c.businessType = @bt AND c.isDefault = true',
      parameters: [
        { name: '@lob', value: pipeline.lineOfBusiness },
        { name: '@bt', value: pipeline.businessType || 'individual' },
      ],
    };

    const { resources: existing } = await container.items
      .query<PipelineDefinition>(query)
      .fetchAll();

    if (existing.length > 0) {
      console.log('⚠️  Default pipeline already exists for medical/individual');
      console.log(`   Pipeline ID: ${existing[0].pipelineId}`);
      console.log(`   Name: ${existing[0].name}`);
      console.log(`   Status: ${existing[0].status}`);
      console.log('\n   To recreate, delete the existing pipeline first.');
      return;
    }

    // Create the pipeline
    console.log('📝 Creating pipeline...');
    const { resource: created } = await container.items.create(pipeline);
    console.log(`✅ Pipeline created: ${created?.pipelineId}\n`);

    // Activate the pipeline
    console.log('🔓 Activating pipeline...');
    const now = new Date().toISOString();
    const activated: PipelineDefinition = {
      ...created!,
      status: 'active',
      activatedAt: now,
      activatedBy: 'system-seeder',
      updatedAt: now,
      updatedBy: 'system-seeder',
    };

    await container.item(created!.id, created!.lineOfBusiness).replace(activated);
    console.log('✅ Pipeline activated\n');

    // Print summary
    console.log('='.repeat(60));
    console.log('Pipeline Seeding Complete!');
    console.log('='.repeat(60));
    console.log(`\nPipeline: ${activated.name}`);
    console.log(`ID: ${activated.pipelineId}`);
    console.log(`LOB: ${activated.lineOfBusiness}`);
    console.log(`Business Type: ${activated.businessType}`);
    console.log(`Status: ${activated.status}`);
    console.log(`Steps: ${activated.steps.length}`);
    console.log('\nSteps:');
    activated.steps
      .sort((a, b) => a.order - b.order)
      .forEach((step, index) => {
        const status = step.enabled ? '✅' : '⏸️';
        console.log(`  ${status} ${index + 1}. ${step.name || step.id} (${step.type})`);
      });
    console.log('\n🎉 Done!');

  } catch (error) {
    console.error('\n❌ Error seeding pipelines:', error);
    process.exit(1);
  }
}

// Run the seeder
seedPipelines().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

