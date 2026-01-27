/**
 * Update Pipeline Event Types
 * 
 * This script fixes the event type mismatch by updating:
 * - completionEvent from 'service.fetch_plans.completed' to 'plans.fetch_completed'
 * - exitConditions from ['service.fetch_plans.completed'] to ['plans.fetch_completed']
 * 
 * Usage: npx ts-node scripts/updatePipelineEventTypes.ts
 */

import { initializeDatabase, getPipelinesContainer } from '../src/lib/cosmosClient';

async function main() {
  console.log('===========================================');
  console.log('Pipeline Event Type Update Script');
  console.log('===========================================\n');

  console.log('Step 1: Initializing database...');
  try {
    await initializeDatabase();
    console.log('✓ Database initialized\n');
  } catch (error: any) {
    console.error('✗ Failed to initialize database:', error.message);
    process.exit(1);
  }

  console.log('Step 2: Finding medical pipeline...');
  const container = getPipelinesContainer();
  
  const { resources: pipelines } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.lineOfBusiness = @lob AND c.status = 'active'",
      parameters: [{ name: '@lob', value: 'medical' }]
    })
    .fetchAll();

  if (pipelines.length === 0) {
    console.error('✗ No active medical pipeline found');
    process.exit(1);
  }

  console.log(`✓ Found ${pipelines.length} pipeline(s)\n`);

  for (const pipeline of pipelines) {
    console.log(`Step 3: Updating pipeline "${pipeline.name}" (${pipeline.id})...`);
    
    let updated = false;
    
    // Find and update Lead Created step
    for (const step of pipeline.steps) {
      if (step.stageId === 'lead-created' && step.actionConfig?.primaryAction?.asyncAction) {
        const asyncAction = step.actionConfig.primaryAction.asyncAction;
        
        // Check current values
        console.log(`  Current completionEvent: ${asyncAction.completionEvent}`);
        console.log(`  Current exitConditions: ${JSON.stringify(step.metadata?.exitConditions)}`);
        
        // Update if needed
        if (asyncAction.completionEvent === 'service.fetch_plans.completed') {
          asyncAction.completionEvent = 'plans.fetch_completed';
          console.log(`  ✓ Updated completionEvent to: plans.fetch_completed`);
          updated = true;
        }
        
        // Also update requiredData to be less strict
        if (asyncAction.requiredData?.includes('businessType') || asyncAction.requiredData?.includes('lobData')) {
          asyncAction.requiredData = ['leadId', 'lineOfBusiness'];
          console.log(`  ✓ Updated requiredData to: ['leadId', 'lineOfBusiness']`);
          updated = true;
        }
        
        if (step.metadata?.exitConditions?.includes('service.fetch_plans.completed')) {
          step.metadata.exitConditions = step.metadata.exitConditions.map(
            (e: string) => e === 'service.fetch_plans.completed' ? 'plans.fetch_completed' : e
          );
          console.log(`  ✓ Updated exitConditions to: ${JSON.stringify(step.metadata.exitConditions)}`);
          updated = true;
        }
      }
    }
    
    if (updated) {
      pipeline.updatedAt = new Date().toISOString();
      
      try {
        await container.item(pipeline.id, pipeline.lineOfBusiness).replace(pipeline);
        console.log(`\n✓ Pipeline "${pipeline.name}" updated successfully!\n`);
      } catch (error: any) {
        console.error(`\n✗ Failed to update pipeline: ${error.message}`);
        process.exit(1);
      }
    } else {
      console.log(`\n✓ Pipeline "${pipeline.name}" already has correct values - no update needed\n`);
    }
  }

  console.log('===========================================');
  console.log('✓ Pipeline event types update complete!');
  console.log('===========================================\n');
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
