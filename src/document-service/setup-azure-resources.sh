#!/bin/bash

# Azure Resources Setup Script
# This script creates all required Azure resources for the Document Service

set -e

# Configuration
RESOURCE_GROUP="document-service-rg"
LOCATION="eastus"
COSMOS_ACCOUNT="document-cosmos-$(date +%s)"
STORAGE_ACCOUNT="docstorage$(date +%s | cut -c 1-13)"
EVENTGRID_TOPIC="document-events"
FUNCTION_APP="document-functions-$(date +%s)"

echo "================================"
echo "Azure Resources Setup"
echo "================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "================================"

# Create Resource Group
echo "📦 Creating resource group..."
az group create \
  --name $RESOURCE_GROUP \
  --location $LOCATION

# Create Cosmos DB Account
echo "🗄️  Creating Cosmos DB account..."
az cosmosdb create \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --default-consistency-level Session \
  --locations regionName=$LOCATION failoverPriority=0

# Create Cosmos DB Database
echo "📊 Creating Cosmos DB database..."
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --name DocumentDB \
  --resource-group $RESOURCE_GROUP

# Create Cosmos DB Container with TTL
echo "📋 Creating Cosmos DB container with TTL..."
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name DocumentDB \
  --name documents \
  --partition-key-path "/customerId" \
  --default-ttl -1 \
  --resource-group $RESOURCE_GROUP

# Create Storage Account
echo "💾 Creating Storage account..."
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Create Blob Container
echo "📁 Creating Blob container..."
az storage container create \
  --name customerDocuments \
  --account-name $STORAGE_ACCOUNT

# Create Event Grid Topic
echo "📡 Creating Event Grid topic..."
az eventgrid topic create \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

# Create Function App (Consumption Plan)
echo "⚡ Creating Function App..."
az functionapp create \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --storage-account $STORAGE_ACCOUNT \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4

# Get connection strings
echo "🔑 Retrieving connection strings..."
COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString \
  --output tsv)

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

# Configure Function App Settings
echo "⚙️  Configuring Function App settings..."
az functionapp config appsettings set \
  --name $FUNCTION_APP \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_DB_CONNECTION_STRING=$COSMOS_CONNECTION" \
    "COSMOS_DB_DATABASE_NAME=DocumentDB" \
    "COSMOS_DB_CONTAINER_NAME=documents" \
    "BLOB_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION" \
    "BLOB_STORAGE_CONTAINER_NAME=customerDocuments" \
    "EVENT_GRID_TOPIC_ENDPOINT=$EVENTGRID_ENDPOINT" \
    "EVENT_GRID_TOPIC_KEY=$EVENTGRID_KEY"

echo ""
echo "✅ Azure resources created successfully!"
echo ""
echo "================================"
echo "Resource Details"
echo "================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Cosmos DB Account: $COSMOS_ACCOUNT"
echo "Storage Account: $STORAGE_ACCOUNT"
echo "Event Grid Topic: $EVENTGRID_TOPIC"
echo "Function App: $FUNCTION_APP"
echo "================================"
echo ""
echo "📝 Next steps:"
echo "1. Deploy your functions: ./deploy.sh $FUNCTION_APP $RESOURCE_GROUP"
echo "2. Configure CORS in Azure Portal if needed"
echo "3. Set up monitoring and alerts"
echo ""

