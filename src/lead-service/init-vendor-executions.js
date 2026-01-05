const { CosmosClient } = require("@azure/cosmos");

async function createVendorExecutionsContainer() {
  const connectionString = process.env.COSMOS_CONNECTION_STRING;
  const endpoint = process.env.COSMOS_DB_ENDPOINT;
  const key = process.env.COSMOS_DB_KEY;
  const databaseName = process.env.COSMOS_DB_NAME || "lead-service-db";
  
  let client;
  if (connectionString) {
    client = new CosmosClient(connectionString);
  } else if (endpoint && key) {
    client = new CosmosClient({ endpoint, key });
  } else {
    console.error("No Cosmos DB credentials found");
    return;
  }

  const database = client.database(databaseName);
  
  try {
    const { container } = await database.containers.createIfNotExists({
      id: "vendorExecutions",
      partitionKey: { paths: ["/leadId"] },
      indexingPolicy: {
        indexingMode: 'consistent',
        automatic: true,
        includedPaths: [{ path: '/*' }],
        excludedPaths: [{ path: '/_etag/?' }],
        compositeIndexes: [
          [
            { path: '/leadId', order: 'ascending' },
            { path: '/timestamp', order: 'descending' }
          ],
          [
            { path: '/vendorId', order: 'ascending' },
            { path: '/timestamp', order: 'descending' }
          ]
        ]
      }
    });
    console.log("VendorExecutions container created/verified:", container.id);
  } catch (error) {
    console.error("Error creating container:", error.message);
  }
}

createVendorExecutionsContainer();




