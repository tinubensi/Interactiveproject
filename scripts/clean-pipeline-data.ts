/**
 * Pipeline Data Cleanup Script
 * Cleans existing pipeline instances and old pipeline definitions
 * Run before deploying enhanced pipeline
 * 
 * Usage: npx ts-node scripts/clean-pipeline-data.ts
 */

import { cosmosClient } from '../src/pipeline-service/src/lib/cosmosClient';

interface CleanupStats {
  instancesDeleted: number;
  pipelinesDeleted: number;
  errors: string[];
}

async function cleanPipelineData(): Promise<CleanupStats> {
  const stats: CleanupStats = {
    instancesDeleted: 0,
    pipelinesDeleted: 0,
    errors: [],
  };

  console.log('===========================================');
  console.log('Pipeline Data Cleanup');
  console.log('===========================================\n');

  const database = cosmosClient.database(process.env.COSMOS_DATABASE_NAME || 'nectaria-db');

  // Step 1: Delete all pipeline instances
  console.log('Step 1: Deleting pipeline instances...');
  try {
    const instancesContainer = database.container('pipeline-instances');
    const { resources: instances } = await instancesContainer.items
      .readAll()
      .fetchAll();

    console.log(`Found ${instances.length} pipeline instances`);

    for (const instance of instances) {
      try {
        await instancesContainer.item(instance.id, instance.leadId).delete();
        stats.instancesDeleted++;
        console.log(`  ✓ Deleted instance: ${instance.instanceId} (lead: ${instance.leadId})`);
      } catch (error: any) {
        const errorMsg = `Failed to delete instance ${instance.instanceId}: ${error.message}`;
        console.error(`  ✗ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`✓ Deleted ${stats.instancesDeleted}/${instances.length} instances\n`);
  } catch (error: any) {
    const errorMsg = `Failed to access pipeline instances container: ${error.message}`;
    console.error(`✗ ${errorMsg}\n`);
    stats.errors.push(errorMsg);
  }

  // Step 2: Delete old pipeline definitions (version 1)
  console.log('Step 2: Deleting old pipeline definitions (version 1)...');
  try {
    const pipelinesContainer = database.container('pipeline-definitions');
    const { resources: pipelines } = await pipelinesContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.version = 1',
      })
      .fetchAll();

    console.log(`Found ${pipelines.length} old pipeline definitions`);

    for (const pipeline of pipelines) {
      try {
        await pipelinesContainer.item(pipeline.id, pipeline.pipelineId).delete();
        stats.pipelinesDeleted++;
        console.log(`  ✓ Deleted pipeline: ${pipeline.name} (version ${pipeline.version})`);
      } catch (error: any) {
        const errorMsg = `Failed to delete pipeline ${pipeline.pipelineId}: ${error.message}`;
        console.error(`  ✗ ${errorMsg}`);
        stats.errors.push(errorMsg);
      }
    }

    console.log(`✓ Deleted ${stats.pipelinesDeleted}/${pipelines.length} old pipelines\n`);
  } catch (error: any) {
    const errorMsg = `Failed to access pipeline definitions container: ${error.message}`;
    console.error(`✗ ${errorMsg}\n`);
    stats.errors.push(errorMsg);
  }

  // Step 3: Optionally clean up action history (if exists)
  console.log('Step 3: Checking for action history container...');
  try {
    const actionHistoryContainer = database.container('pipeline-action-history');
    const { resources: actionHistory } = await actionHistoryContainer.items
      .readAll()
      .fetchAll();

    if (actionHistory.length > 0) {
      console.log(`Found ${actionHistory.length} action history records`);
      console.log('(Not deleting - keeping for audit trail)');
    } else {
      console.log('No action history found\n');
    }
  } catch (error: any) {
    // Container might not exist yet
    console.log('Action history container not found (this is okay)\n');
  }

  return stats;
}

async function main() {
  try {
    const stats = await cleanPipelineData();

    console.log('===========================================');
    console.log('Cleanup Summary');
    console.log('===========================================');
    console.log(`Pipeline instances deleted: ${stats.instancesDeleted}`);
    console.log(`Pipeline definitions deleted: ${stats.pipelinesDeleted}`);
    console.log(`Errors encountered: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\nErrors:');
      stats.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n===========================================');
    if (stats.errors.length === 0) {
      console.log('✓ Cleanup completed successfully!');
    } else {
      console.log('⚠ Cleanup completed with some errors');
    }
    console.log('===========================================\n');

    console.log('Next Steps:');
    console.log('  1. Run seed script: npm run seed:enhanced-pipeline');
    console.log('  2. Setup Event Grid subscriptions');
    console.log('  3. Test with a new lead creation\n');

    process.exit(stats.errors.length > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('\n===========================================');
    console.error('✗ Cleanup failed with critical error:');
    console.error('===========================================');
    console.error(error);
    process.exit(1);
  }
}

// Confirmation prompt in interactive mode
if (require.main === module) {
  console.log('\n⚠️  WARNING: This will delete all existing pipeline data!');
  console.log('This action cannot be undone.\n');

  // Check for --force flag
  const isForced = process.argv.includes('--force');

  if (isForced) {
    console.log('--force flag detected, proceeding with cleanup...\n');
    main();
  } else {
    console.log('To proceed, run with --force flag:');
    console.log('  npx ts-node scripts/clean-pipeline-data.ts --force\n');
    process.exit(0);
  }
}

export { cleanPipelineData };

