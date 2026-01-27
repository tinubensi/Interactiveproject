/**
 * Fix Stuck Pipeline Instance
 * 
 * Updates the waitingForEvent field from 'service.fetch_plans.completed' 
 * to 'plans.fetch_completed' for a specific stuck lead
 * 
 * Usage: LEAD_ID=xxx npx ts-node scripts/fixStuckInstance.ts
 */

import { initializeDatabase, getInstancesContainer } from '../src/lib/cosmosClient';

async function main() {
  const leadId = process.env.LEAD_ID || '1857c83b-de0e-47ec-bb13-d273da5734fb';
  
  console.log('===========================================');
  console.log('Fix Stuck Pipeline Instance');
  console.log('===========================================\n');
  console.log(`Target Lead ID: ${leadId}\n`);

  console.log('Step 1: Initializing database...');
  try {
    await initializeDatabase();
    console.log('✓ Database initialized\n');
  } catch (error: any) {
    console.error('✗ Failed to initialize database:', error.message);
    process.exit(1);
  }

  console.log('Step 2: Finding instance for lead...');
  const container = getInstancesContainer();
  
  const { resources: instances } = await container.items
    .query({
      query: "SELECT * FROM c WHERE c.leadId = @leadId AND c.status = 'active'",
      parameters: [{ name: '@leadId', value: leadId }]
    })
    .fetchAll();

  if (instances.length === 0) {
    console.error('✗ No active instance found for this lead');
    process.exit(1);
  }

  console.log(`✓ Found ${instances.length} instance(s)\n`);

  for (const instance of instances) {
    console.log(`Step 3: Updating instance "${instance.instanceId}"...`);
    console.log(`  Document id: ${instance.id}`);
    console.log(`  Instance ID: ${instance.instanceId}`);
    console.log(`  Lead ID: ${instance.leadId}`);
    console.log(`  Current stage: ${instance.currentStageName}`);
    console.log(`  Current waitingForEvent: ${instance.waitingForEvent}`);
    
    let updated = false;
    
    if (instance.waitingForEvent === 'service.fetch_plans.completed') {
      instance.waitingForEvent = 'plans.fetch_completed';
      instance.updatedAt = new Date().toISOString();
      updated = true;
      console.log(`  ✓ Updated waitingForEvent to: plans.fetch_completed`);
    }
    
    if (updated) {
      try {
        // Use instanceId as the document id (some instances may use instanceId instead of id)
        const docId = instance.id || instance.instanceId;
        console.log(`  Document ID: ${docId}`);
        console.log(`  Partition key (leadId): ${instance.leadId}`);
        
        await container.item(docId, instance.leadId).replace(instance);
        console.log(`\n✓ Instance "${instance.instanceId}" updated successfully!\n`);
      } catch (error: any) {
        console.error(`\n✗ Failed to update instance: ${error.message}`);
        
        // Try upsert as fallback
        console.log('\nTrying upsert as fallback...');
        try {
          await container.items.upsert(instance);
          console.log(`\n✓ Instance "${instance.instanceId}" upserted successfully!\n`);
        } catch (upsertError: any) {
          console.error(`\n✗ Upsert also failed: ${upsertError.message}`);
          process.exit(1);
        }
      }
    } else {
      console.log(`\n✓ Instance already has correct waitingForEvent - no update needed\n`);
    }
  }

  console.log('===========================================');
  console.log('✓ Stuck instance fix complete!');
  console.log('===========================================\n');
  console.log('Next steps:');
  console.log('  1. Manually trigger plans.fetch_completed event, or');
  console.log('  2. Trigger a plan refetch for this lead\n');
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
