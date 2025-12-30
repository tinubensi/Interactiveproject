/**
 * Test script to verify vendors in Cosmos DB
 */
import { CosmosClient } from '@azure/cosmos';

const connectionString = process.env.COSMOS_CONNECTION_STRING!;
const client = new CosmosClient(connectionString);
const database = client.database('quotation-generation-service-db');
const container = database.container('vendors');

async function testQuery() {
  console.log('Querying vendors from Cosmos DB...');
  
  const query = 'SELECT * FROM c WHERE c.lineOfBusiness = "medical" AND c.isActive = true ORDER BY c.priority ASC';
  const { resources } = await container.items.query(query).fetchAll();
  
  console.log(`Found ${resources.length} vendors for medical:`);
  resources.forEach(v => {
    console.log(`  - ${v.name} (${v.code}): RPA=${v.rpaEnabled}, Active=${v.isActive}`);
  });
  
  return resources;
}

testQuery().catch(console.error);

