# Azure Cosmos DB Setup Guide

This guide helps you set up Azure Cosmos DB for both local development and cloud deployment.

## Prerequisites

- Docker installed and running (for local emulator)
- Azure CLI installed (for cloud setup)
- Node.js and npm installed

## Local Development Setup

### Option 1: Using the Setup Script (Recommended)

```bash
# Run the local setup script
./scripts/setup-cosmos-local.sh
```

This script will:
- Start Azure Cosmos DB Emulator in a Docker container
- Configure it to run on `https://localhost:8081`
- Use the default emulator key

### Option 2: Manual Docker Setup

```bash
# Start Cosmos DB Emulator
docker run -d \
    --name cosmos-emulator \
    -p 8081:8081 \
    -p 10250-10255:10250-10255 \
    -m 3g \
    -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
    -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
    mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest

# Wait for it to start (about 10 seconds)
sleep 10

# Check if running
docker ps | grep cosmos-emulator
```

### Local Connection Details

The `local.settings.json` is already configured with:
- **Endpoint**: `https://localhost:8081`
- **Key**: `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==`
- **Database**: `CustomerDB`

### Managing Local Emulator

```bash
# Stop the emulator
docker stop cosmos-emulator

# Start the emulator (if already created)
docker start cosmos-emulator

# View logs
docker logs cosmos-emulator

# Remove the container
docker rm cosmos-emulator
```

### Accessing Local Emulator UI

Once the emulator is running, you can access the Data Explorer at:
- **URL**: https://localhost:8081/_explorer/index.html
- **Note**: You may need to accept the self-signed certificate in your browser

## Cloud Setup

### Option 1: Using the Setup Script (Recommended)

```bash
# Set environment variables (optional)
export RESOURCE_GROUP="cs-rg"
export LOCATION="eastus"
export COSMOS_ACCOUNT_NAME="cs-cosmos-12345"  # Must be globally unique

# Run the cloud setup script
./scripts/setup-cosmos-cloud.sh
```

### Option 2: Manual Azure CLI Setup

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="cs-rg"
LOCATION="eastus"
COSMOS_ACCOUNT_NAME="cs-cosmos-$(date +%s)"  # Must be globally unique
DATABASE_NAME="CustomerDB"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cosmos DB account
az cosmosdb create \
    --name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --default-consistency-level Session \
    --locations regionName=$LOCATION failoverPriority=0

# Get connection details
ENDPOINT=$(az cosmosdb show --name $COSMOS_ACCOUNT_NAME --resource-group $RESOURCE_GROUP --query documentEndpoint -o tsv)
KEY=$(az cosmosdb keys list --name $COSMOS_ACCOUNT_NAME --resource-group $RESOURCE_GROUP --query primaryMasterKey -o tsv)

# Create database
az cosmosdb sql database create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --name $DATABASE_NAME

# Create customers container
az cosmosdb sql container create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --database-name $DATABASE_NAME \
    --name customers \
    --partition-key-path "/id" \
    --throughput 400

# Create otps container
az cosmosdb sql container create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --database-name $DATABASE_NAME \
    --name otps \
    --partition-key-path "/email" \
    --throughput 400

echo "Endpoint: $ENDPOINT"
echo "Key: $KEY"
```

### Update Configuration for Cloud

Update your `local.settings.json` or Azure Function App settings with the cloud connection details:

```json
{
  "COSMOS_DB_ENDPOINT": "<your-cloud-endpoint>",
  "COSMOS_DB_KEY": "<your-cloud-key>",
  "COSMOS_DB_DATABASE": "CustomerDB"
}
```

## Verify Setup

### Test Local Connection

```bash
# Start the Azure Functions
npm start

# In another terminal, test the signup endpoint
curl -X POST http://localhost:7071/api/customers/signup \
  -H "Content-Type: application/json" \
  -d '{
    "customerType": "INDIVIDUAL",
    "firstName": "Test",
    "lastName": "User",
    "name": "Test User",
    "email": "test@example.com",
    "gender": "Male",
    "agent": "Direct"
  }'
```

### Check Containers in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your Cosmos DB account
3. Open "Data Explorer"
4. Verify that `CustomerDB` database exists with `customers` and `otps` containers

## Troubleshooting

### Local Emulator Issues

**Problem**: Docker container won't start
- **Solution**: Ensure Docker has at least 3GB of memory allocated
- Check: `docker info | grep Memory`

**Problem**: Connection refused on localhost:8081
- **Solution**: Wait a bit longer for the emulator to fully start (can take 30-60 seconds)
- Check logs: `docker logs cosmos-emulator`

**Problem**: SSL certificate errors
- **Solution**: The emulator uses a self-signed certificate. You may need to:
  - Accept the certificate in your browser
  - Set `NODE_TLS_REJECT_UNAUTHORIZED=0` for Node.js (development only!)

### Cloud Setup Issues

**Problem**: Cosmos account name already exists
- **Solution**: Cosmos DB account names must be globally unique. Use a different name or add a random suffix.

**Problem**: Resource group doesn't exist
- **Solution**: Create it first: `az group create --name <name> --location <location>`

## Cost Considerations

### Local Emulator
- **Free**: No cost, runs locally

### Cloud (Free Tier)
- Azure Cosmos DB offers a free tier with:
  - 400 RU/s throughput
  - 5 GB storage
  - First 30 days free

### Cloud (Pay-as-you-go)
- After free tier: ~$24/month for 400 RU/s + storage costs
- Consider using serverless mode for development/testing

## Next Steps

1. Start the local emulator: `./scripts/setup-cosmos-local.sh`
2. Install dependencies: `npm install` (already done)
3. Build the project: `npm run build`
4. Start Azure Functions: `npm start`
5. Test the endpoints using the API routes

## Additional Resources

- [Azure Cosmos DB Emulator Documentation](https://docs.microsoft.com/azure/cosmos-db/local-emulator)
- [Azure Cosmos DB Node.js SDK](https://docs.microsoft.com/azure/cosmos-db/sql/sql-api-sdk-node)
- [Azure CLI Cosmos DB Commands](https://docs.microsoft.com/cli/azure/cosmosdb)

