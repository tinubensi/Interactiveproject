#!/bin/bash

# Azure Functions Deployment Script
# Usage: ./deploy.sh <function-app-name> <resource-group>

set -e

if [ $# -lt 2 ]; then
    echo "Usage: ./deploy.sh <function-app-name> <resource-group>"
    echo "Example: ./deploy.sh my-document-service my-resource-group"
    exit 1
fi

FUNCTION_APP_NAME=$1
RESOURCE_GROUP=$2

echo "================================"
echo "Azure Functions Deployment"
echo "================================"
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "================================"

# Build the project
echo "📦 Building TypeScript project..."
npm run build

# Deploy to Azure
echo "🚀 Deploying to Azure Functions..."
func azure functionapp publish $FUNCTION_APP_NAME

echo "✅ Deployment completed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Configure application settings in Azure Portal"
echo "2. Set up Event Grid subscriptions"
echo "3. Configure CORS if needed"
echo "4. Test the endpoints"

