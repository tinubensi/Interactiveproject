/**
 * Pipeline Migration Script
 * Updates existing pipelines to include the Revision Requested stage
 * 
 * Usage: npm run build && node dist/scripts/migratePipelinesWithRevisionStage.js
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from local.settings.json
const settingsPath = join(__dirname, '../../local.settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
Object.assign(process.env, settings.Values);

import { initializeDatabase, getPipelinesContainer } from '../src/lib/cosmosClient';
import { generateDefaultHealthInsurancePipeline } from '../src/data/seedDefaultPipeline';
import type { PipelineDefinition, StageStep, DecisionStep } from '../src/models/pipeline';
import { v4 as uuidv4 } from 'uuid';

async function migratePipelines(): Promise<void> {
  console.log('🚀 Starting Pipeline Migration...\n');
  console.log('📋 This will update existing pipelines to include the Revision Requested stage\n');

  try {
    // Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();
    console.log('✅ Database initialized\n');

    // Get the pipelines container
    const container = getPipelinesContainer();

    // Get all active pipelines
    const query = {
      query: 'SELECT * FROM c WHERE c.status = @status',
      parameters: [
        { name: '@status', value: 'active' },
      ],
    };

    const { resources: pipelines } = await container.items
      .query<PipelineDefinition>(query)
      .fetchAll();

    if (pipelines.length === 0) {
      console.log('⚠️  No active pipelines found. Nothing to migrate.');
      return;
    }

    console.log(`📊 Found ${pipelines.length} active pipeline(s) to migrate\n`);

    // Generate the new default pipeline to get the Revision Requested step structure
    const newDefaultPipeline = generateDefaultHealthInsurancePipeline('system-migration');
    const revisionStepTemplate = newDefaultPipeline.steps.find(
      step => step.type === 'stage' && (step as StageStep).stageId === 'revision-requested'
    ) as StageStep | undefined;

    if (!revisionStepTemplate) {
      console.error('❌ Error: Revision Requested step template not found in new default pipeline');
      process.exit(1);
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const pipeline of pipelines) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`📝 Processing: ${pipeline.name}`);
      console.log(`   Pipeline ID: ${pipeline.pipelineId}`);
      console.log(`   LOB: ${pipeline.lineOfBusiness}`);
      console.log(`   Steps: ${pipeline.steps.length}`);

      // Check if Revision Requested stage already exists
      const hasRevisionStage = pipeline.steps.some(
        step => step.type === 'stage' && (step as StageStep).stageId === 'revision-requested'
      );

      if (hasRevisionStage) {
        console.log(`   ⏭️  Already has Revision Requested stage - skipping`);
        skippedCount++;
        continue;
      }

      // Find the customer response decision step
      const decisionStepIndex = pipeline.steps.findIndex(
        step => step.type === 'decision' && 
        step.name === 'Quotation Approved?' &&
        (step as DecisionStep).conditionType === 'quotation_approved'
      );

      if (decisionStepIndex === -1) {
        console.log(`   ⚠️  Customer response decision step not found - skipping`);
        skippedCount++;
        continue;
      }

      const decisionStep = pipeline.steps[decisionStepIndex] as DecisionStep;
      console.log(`   📍 Found decision step: ${decisionStep.name} (order: ${decisionStep.order})`);

      // Create the Revision Requested step
      const revisionStepId = uuidv4();
      const revisionStep: StageStep = {
        id: revisionStepId,
        order: decisionStep.order + 0.5, // Insert between decision (9) and pending review (10)
        enabled: true,
        type: 'stage',
        stageId: 'revision-requested',
        stageName: 'Revision Requested',
        name: 'Revision Requested',
        description: 'Customer requested changes to the quotation - awaiting agent action',
        allowedActions: ['CREATE_NEW_QUOTATION', 'MANUAL_ADVANCE'],
      };

      // Update step orders: shift steps after decision step by +0.5
      // But we need to be careful - we want order 9.5, so steps at 10+ should become 10.5+
      const updatedSteps = pipeline.steps.map(step => {
        if (step.order > decisionStep.order && step.order < decisionStep.order + 1) {
          // Steps between decision and next major step get shifted
          return { ...step, order: step.order + 0.5 };
        }
        return step;
      });

      // Insert Revision Requested step after decision step
      updatedSteps.splice(decisionStepIndex + 1, 0, revisionStep);

      // Re-sort steps by order
      updatedSteps.sort((a, b) => a.order - b.order);

      // Update the pipeline
      const now = new Date().toISOString();
      const updatedPipeline: PipelineDefinition = {
        ...pipeline,
        steps: updatedSteps,
        updatedAt: now,
        updatedBy: 'system-migration',
      };

      await container.item(pipeline.id, pipeline.lineOfBusiness).replace(updatedPipeline);
      console.log(`   ✅ Updated with Revision Requested stage (order: ${revisionStep.order})`);
      migratedCount++;
    }

    console.log('\n' + '='.repeat(60));
    console.log('Pipeline Migration Complete!');
    console.log('='.repeat(60));
    console.log(`\n✅ Migrated: ${migratedCount} pipeline(s)`);
    console.log(`⏭️  Skipped: ${skippedCount} pipeline(s)`);
    console.log(`📊 Total: ${pipelines.length} pipeline(s)`);
    console.log('\n🎉 Done!');

  } catch (error) {
    console.error('\n❌ Error migrating pipelines:', error);
    process.exit(1);
  }
}

// Run the migration
migratePipelines().then(() => {
  process.exit(0);
}).catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

