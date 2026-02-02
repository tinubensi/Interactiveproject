#!/bin/bash

# EMAF Service Deployment Script
# Usage: ./deploy.sh [function-app-name] [resource-group]

set -e

# Default values
FUNCTION_APP_NAME="${1:-emaf-service-func}"
RESOURCE_GROUP="${2:-Interactive-CRM-Dev}"
LOCATION="uaenorth"
STORAGE_ACCOUNT="docstorage1763959700"
COSMOS_ACCOUNT="interactivecrmdevdb"
COSMOS_DATABASE="emaf-service-db"
BLOB_CONTAINER="emaf-documents"
QUEUE_NAME="pdf-generation-queue"

echo "================================"
echo "EMAF Service Deployment"
echo "================================"
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "================================"
echo ""

# Step 1: Install dependencies
echo "📦 [1/6] Installing dependencies..."
cd "$(dirname "$0")"
npm install
echo "✅ Dependencies installed"
echo ""

# Step 2: Build the project
echo "🔨 [2/6] Building TypeScript project..."
npm run build
echo "✅ Build completed"
echo ""

# Step 3: Check if Function App exists, create if not
echo "🔍 [3/6] Checking Function App..."
FUNC_EXISTS=$(az functionapp show --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP 2>/dev/null || echo "")

if [ -z "$FUNC_EXISTS" ]; then
  echo "Creating Function App..."
  az functionapp create \
    --name $FUNCTION_APP_NAME \
    --resource-group $RESOURCE_GROUP \
    --storage-account $STORAGE_ACCOUNT \
    --consumption-plan-location "$LOCATION" \
    --runtime node \
    --runtime-version 24 \
    --functions-version 4 \
    --os-type Linux
  echo "✅ Function App created"
else
  echo "✅ Function App already exists"
fi
echo ""

# Step 4: Setup Cosmos DB containers
echo "📊 [4/6] Setting up Cosmos DB containers..."

# Create database if not exists
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --name $COSMOS_DATABASE \
  2>/dev/null || echo "Database already exists"

# Create templates container
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $COSMOS_DATABASE \
  --resource-group $RESOURCE_GROUP \
  --name "emaf-templates" \
  --partition-key-path "/vendorId" \
  --throughput 400 \
  2>/dev/null || echo "Templates container already exists"

# Create submissions container
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name $COSMOS_DATABASE \
  --resource-group $RESOURCE_GROUP \
  --name "emaf-submissions" \
  --partition-key-path "/leadId" \
  --throughput 400 \
  2>/dev/null || echo "Submissions container already exists"

echo "✅ Cosmos DB containers configured"
echo ""

# Step 5: Setup Blob Storage container
echo "💾 [5/6] Setting up Blob Storage..."
az storage container create \
  --name $BLOB_CONTAINER \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login \
  2>/dev/null || echo "Blob container already exists"

# Setup Queue
az storage queue create \
  --name $QUEUE_NAME \
  --account-name $STORAGE_ACCOUNT \
  --auth-mode login \
  2>/dev/null || echo "Queue already exists"

echo "✅ Storage configured"
echo ""

# Step 6: Configure Function App settings
echo "🔑 [6/6] Configuring Function App settings..."

# Get connection strings
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

EVENT_GRID_ENDPOINT="https://interactive-crm-eventgrid.uaenorth-1.eventgrid.azure.net/api/events"
# Get Event Grid access key from Azure
EVENT_GRID_KEY=$(az eventgrid topic key list \
  --name interactive-crm-eventgrid \
  --resource-group $RESOURCE_GROUP \
  --query key1 \
  --output tsv 2>/dev/null || echo "")

# Get service URLs (assuming they follow naming convention)
FORM_SERVICE_URL="https://form-service.azurewebsites.net"
QUOTATION_SERVICE_URL="https://quotation-service-74e1210c.azurewebsites.net"

# Configure app settings
az functionapp config appsettings set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    "COSMOS_CONNECTION_STRING=$COSMOS_CONNECTION" \
    "COSMOS_DATABASE_NAME=$COSMOS_DATABASE" \
    "COSMOS_TEMPLATES_CONTAINER=emaf-templates" \
    "COSMOS_SUBMISSIONS_CONTAINER=emaf-submissions" \
    "BLOB_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION" \
    "BLOB_CONTAINER_NAME=$BLOB_CONTAINER" \
    "EVENT_GRID_TOPIC_ENDPOINT=$EVENT_GRID_ENDPOINT" \
    "EVENT_GRID_TOPIC_KEY=$EVENT_GRID_KEY" \
    "FORM_SERVICE_URL=$FORM_SERVICE_URL" \
    "QUOTATION_SERVICE_URL=$QUOTATION_SERVICE_URL" \
    "PDF_GENERATION_QUEUE_NAME=$QUEUE_NAME" \
    "JWT_SECRET=your-production-secret-key-here" \
    "SERVICE_KEY=nectaria-internal-2026" \
    "FRONTEND_URL=https://frontend-livid-xi-43.vercel.app" \
    "AzureWebJobsStorage=$STORAGE_CONNECTION" \
    "WEBSITE_NODE_DEFAULT_VERSION=~24" \
    "FUNCTIONS_WORKER_RUNTIME=node"

echo "✅ App settings configured"
echo ""

# Enable CORS
echo "🌐 Configuring CORS..."
az functionapp cors add \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --allowed-origins "*" \
  2>/dev/null || echo "CORS already configured"

echo "✅ CORS configured"
echo ""

# Deploy to Azure
echo "🚀 Deploying to Azure Functions..."
echo "Creating deployment package..."
rm -f deploy.zip
zip -r deploy.zip . -x "*.git*" -x "node_modules/*" -x "dist/*" -x "*.zip" -x ".vscode/*" -x "*.log" > /dev/null
echo "Deploying with remote build..."
az functionapp deployment source config-zip \
  --resource-group $RESOURCE_GROUP \
  --name $FUNCTION_APP_NAME \
  --src deploy.zip \
  --build-remote true
rm -f deploy.zip
echo "Restarting function app..."
az functionapp restart --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP

echo ""
echo "================================"
echo "✅ Deployment completed successfully!"
echo "================================"
echo ""
echo "📝 Function App URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo ""
echo "📋 Next steps:"
echo "1. Verify endpoints at: https://$FUNCTION_APP_NAME.azurewebsites.net/api/health"
echo "2. Test admin endpoints (create EMAF template)"
echo "3. Configure Event Grid subscriptions if needed"
echo "4. Update CORS settings for production domains"
echo "5. Update JWT_SECRET and SERVICE_KEY with production values"
echo ""
