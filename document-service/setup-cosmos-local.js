const { CosmosClient } = require('@azure/cosmos');

// Cosmos DB Emulator connection
const endpoint = 'https://localhost:8081';
const key = 'C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==';

// Disable SSL verification for local emulator
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const client = new CosmosClient({ endpoint, key });

async function setupCosmosDB() {
  try {
    console.log('🔧 Setting up Cosmos DB Emulator...\n');

    // Create database
    console.log('📊 Creating database: DocumentDB');
    const { database } = await client.databases.createIfNotExists({
      id: 'DocumentDB'
    });
    console.log('✅ Database ready: DocumentDB\n');

    // Create container with partition key and TTL
    console.log('📦 Creating container: documents');
    const { container } = await database.containers.createIfNotExists({
      id: 'documents',
      partitionKey: {
        paths: ['/customerId'],
        kind: 'Hash'
      },
      defaultTtl: -1  // Enable per-document TTL
    });
    console.log('✅ Container ready: documents');
    console.log('   - Partition Key: /customerId');
    console.log('   - TTL: Enabled (per-document)\n');

    console.log('🎉 Cosmos DB setup complete!\n');
    console.log('You can now start your Azure Functions:\n');
    console.log('   npm run build');
    console.log('   npm start\n');

  } catch (error) {
    console.error('❌ Error setting up Cosmos DB:', error.message);
    process.exit(1);
  }
}

setupCosmosDB();

