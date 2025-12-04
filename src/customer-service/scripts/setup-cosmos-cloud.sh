#!/bin/bash

# Azure Cosmos DB Cloud Setup Script
# This script creates an Azure Cosmos DB account in the cloud

set -e

# Configuration
RESOURCE_GROUP=${RESOURCE_GROUP:-"cs-rg"}
LOCATION=${LOCATION:-"eastus"}
COSMOS_ACCOUNT_NAME=${COSMOS_ACCOUNT_NAME:-"cs-cosmos-$(date +%s | tail -c 5)"}
DATABASE_NAME=${DATABASE_NAME:-"CustomerDB"}

echo "Setting up Azure Cosmos DB in the cloud..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Cosmos Account: $COSMOS_ACCOUNT_NAME"
echo ""

# Check if logged in to Azure
if ! az account show > /dev/null 2>&1; then
    echo "Please login to Azure..."
    az login
fi

# Create resource group if it doesn't exist
echo "Creating resource group (if it doesn't exist)..."
az group create --name $RESOURCE_GROUP --location $LOCATION 2>/dev/null || echo "Resource group already exists"

# Create Cosmos DB account
echo "Creating Cosmos DB account..."
az cosmosdb create \
    --name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --default-consistency-level Session \
    --locations regionName=$LOCATION failoverPriority=0 \
    --enable-free-tier false

# Get connection details
echo "Retrieving connection details..."
ENDPOINT=$(az cosmosdb show --name $COSMOS_ACCOUNT_NAME --resource-group $RESOURCE_GROUP --query documentEndpoint -o tsv)
KEY=$(az cosmosdb keys list --name $COSMOS_ACCOUNT_NAME --resource-group $RESOURCE_GROUP --query primaryMasterKey -o tsv)

# Create database
echo "Creating database: $DATABASE_NAME..."
az cosmosdb sql database create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --name $DATABASE_NAME

# Create containers
echo "Creating containers..."
az cosmosdb sql container create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --database-name $DATABASE_NAME \
    --name customers \
    --partition-key-path "/id" \
    --throughput 400

az cosmosdb sql container create \
    --account-name $COSMOS_ACCOUNT_NAME \
    --resource-group $RESOURCE_GROUP \
    --database-name $DATABASE_NAME \
    --name otps \
    --partition-key-path "/email" \
    --throughput 400

echo ""
echo "✓ Azure Cosmos DB setup complete!"
echo ""
echo "Connection details:"
echo "  COSMOS_DB_ENDPOINT: $ENDPOINT"
echo "  COSMOS_DB_KEY: $KEY"
echo "  COSMOS_DB_DATABASE: $DATABASE_NAME"
echo ""
echo "Update your local.settings.json or Azure Function App settings with these values."
echo ""
echo "To delete this Cosmos DB account:"
echo "  az cosmosdb delete --name $COSMOS_ACCOUNT_NAME --resource-group $RESOURCE_GROUP --yes"

