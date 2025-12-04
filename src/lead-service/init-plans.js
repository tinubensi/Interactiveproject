const { CosmosClient } = require("@azure/cosmos");

async function createPlansContainer() {
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
      id: "plans",
      partitionKey: { paths: ["/leadId"] }
    });
    console.log("Plans container created/verified:", container.id);
  } catch (error) {
    console.error("Error creating container:", error.message);
  }
}

createPlansContainer();
