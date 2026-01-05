/**
 * Clear all data from Cosmos DB databases
 * This will delete all documents from all containers
 * 
 * Usage: COSMOS_CONNECTION_STRING="your-connection-string" node clear-cosmos-data.js
 */

const { CosmosClient } = require('@azure/cosmos');

// Use environment variable instead of hardcoded credentials
const connectionString = process.env.COSMOS_CONNECTION_STRING;

if (!connectionString) {
  console.error('❌ Error: COSMOS_CONNECTION_STRING environment variable is required');
  console.log('\nUsage:');
  console.log('  COSMOS_CONNECTION_STRING="your-connection-string" node clear-cosmos-data.js');
  process.exit(1);
}

const client = CosmosClient.fromConnectionString(connectionString);

const databasesToClean = [
  { name: 'pipeline-db', containers: ['pipelines', 'instances', 'approvals'] },
  { name: 'lead-service-db', containers: ['leads', 'timelines', 'stages', 'metadata'] },
  { name: 'quotation-service-db', containers: ['quotations'] },
  { name: 'quotation-generation-service-db', containers: ['fetch-requests', 'plans'] },
  { name: 'policy-service-db', containers: ['policy-requests', 'policies'] },
];

async function clearContainer(databaseName, containerName) {
  try {
    const database = client.database(databaseName);
    const container = database.container(containerName);

    console.log(`\n📦 Clearing container: ${databaseName}/${containerName}`);

    // Query all documents
    const query = 'SELECT * FROM c';
    const { resources } = await container.items.query(query).fetchAll();

    console.log(`   Found ${resources.length} documents`);

    // Delete each document
    for (const doc of resources) {
      await container.item(doc.id, doc.id).delete();
    }

    console.log(`   ✅ Cleared ${resources.length} documents`);
  } catch (error) {
    console.error(`   ❌ Error clearing ${databaseName}/${containerName}:`, error.message);
  }
}

async function clearAllData() {
  console.log('🧹 Starting to clear all Cosmos DB data...\n');

  for (const db of databasesToClean) {
    console.log(`\n🗄️  Database: ${db.name}`);
    for (const container of db.containers) {
      await clearContainer(db.name, container);
    }
  }

  console.log('\n✅ All data cleared successfully!');
}

clearAllData().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
