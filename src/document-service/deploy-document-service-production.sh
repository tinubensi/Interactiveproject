#!/bin/bash

# Document Service Production Deployment Script
# This creates Azure resources and deploys the Document Service

set -e

# Configuration
RESOURCE_GROUP="Interactive-CRM-Dev"
LOCATION="eastus"
COSMOS_ACCOUNT="document-cosmos-$(date +%s)"
EVENTGRID_TOPIC="document-events-topic"
FUNCTION_APP="document-service-func"
STORAGE_ACCOUNT="docstorage1763959700"  # Existing storage account
BLOB_CONTAINER="customerdocuments"  # Existing blob container

echo "================================"
echo "Document Service Deployment"
echo "================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Function App: $FUNCTION_APP"
echo "Cosmos Account: $COSMOS_ACCOUNT"
echo "================================"
echo ""

# Step 1: Create Cosmos DB Account for Document Service
echo "🗄️  [1/6] Creating Cosmos DB account..."
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --default-consistency-level Session \
  --locations regionName=$LOCATION failoverPriority=0 \
  --enable-free-tier false

echo "✅ Cosmos DB account created"
echo ""

# Step 2: Create Cosmos DB Database
echo "📊 [2/6] Creating Cosmos DB database 'DocumentDB'..."
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --name DocumentDB \
  --resource-group $RESOURCE_GROUP

echo "✅ Database created"
echo ""

# Step 3: Create Cosmos DB Container with TTL and partition key
echo "📋 [3/6] Creating Cosmos DB container 'documents' with TTL..."
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name DocumentDB \
  --name documents \
  --partition-key-path "/customerId" \
  --ttl -1 \
  --throughput 400 \
  --resource-group $RESOURCE_GROUP

echo "✅ Container created with TTL enabled"
echo ""

# Step 4: Create Event Grid Topic
echo "📡 [4/6] Creating Event Grid topic..."
az eventgrid topic create \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

echo "✅ Event Grid topic created"
echo ""

# Step 5: Create Function App
echo "⚡ [5/6] Creating Function App..."
az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_ACCOUNT \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --os-type Linux

echo "✅ Function App created"
echo ""

# Step 6: Get connection strings and configure app settings
echo "🔑 [6/6] Configuring Function App settings..."

# Get Cosmos DB connection string
COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

# Get existing Storage connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv)

# Get Event Grid endpoint and key
EVENTGRID_ENDPOINT=$(az eventgrid topic show \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --query endpoint \
  --output tsv)

EVENTGRID_KEY=$(az eventgrid topic key list \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --query key1 \
  --output tsv)

# Configure all app settings
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_DB_CONNECTION_STRING=$COSMOS_CONNECTION" \
    "COSMOS_DB_DATABASE_NAME=DocumentDB" \
    "COSMOS_DB_CONTAINER_NAME=documents" \
    "BLOB_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION" \
    "BLOB_STORAGE_CONTAINER_NAME=$BLOB_CONTAINER" \
    "EVENT_GRID_TOPIC_ENDPOINT=$EVENTGRID_ENDPOINT" \
    "EVENT_GRID_TOPIC_KEY=$EVENTGRID_KEY" \
    "WEBSITE_NODE_DEFAULT_VERSION=~18" \
    "FUNCTIONS_WORKER_RUNTIME=node"

echo "✅ App settings configured"
echo ""

# Enable CORS for Frontend
echo "🌐 Configuring CORS..."
az functionapp cors add \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "http://localhost:3000" "https://your-frontend-domain.com" "*"

echo "✅ CORS configured"
echo ""

# Build and Deploy the code
echo "📦 Building TypeScript project..."
npm run build

echo ""
echo "🚀 Deploying to Azure Functions..."
func azure functionapp publish $FUNCTION_APP

echo ""
echo "✅✅✅ DEPLOYMENT COMPLETED SUCCESSFULLY! ✅✅✅"
echo ""
echo "================================"
echo "📊 Resource Summary"
echo "================================"
echo "Resource Group:    $RESOURCE_GROUP"
echo "Function App:      $FUNCTION_APP"
echo "Cosmos Account:    $COSMOS_ACCOUNT"
echo "Storage Account:   $STORAGE_ACCOUNT"
echo "Event Grid Topic:  $EVENTGRID_TOPIC"
echo "================================"
echo ""
echo "🌐 Function App URL:"
echo "   https://$FUNCTION_APP.azurewebsites.net"
echo ""
echo "📝 API Endpoints:"
echo "   POST   https://$FUNCTION_APP.azurewebsites.net/api/customers/{customerId}/documents"
echo "   GET    https://$FUNCTION_APP.azurewebsites.net/api/customers/{customerId}/documents"
echo "   GET    https://$FUNCTION_APP.azurewebsites.net/api/documents/{docId}/download"
echo "   POST   https://$FUNCTION_APP.azurewebsites.net/api/documents/{docId}/confirm-upload"
echo "   DELETE https://$FUNCTION_APP.azurewebsites.net/api/documents/{docId}"
echo ""
echo "📋 Next Steps:"
echo "   1. Test the endpoints using the URLs above"
echo "   2. Update frontend env: NEXT_PUBLIC_DOCUMENT_API_BASE_URL=https://$FUNCTION_APP.azurewebsites.net"
echo "   3. Set up Event Grid subscriptions if needed"
echo "   4. Configure monitoring and alerts in Azure Portal"
echo ""

