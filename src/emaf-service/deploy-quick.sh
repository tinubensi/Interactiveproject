#!/bin/bash

# Quick EMAF Service Deployment Script (no infrastructure changes)
# Usage: ./deploy-quick.sh [function-app-name] [resource-group]

set -e

FUNCTION_APP_NAME="${1:-emaf-service-func}"
RESOURCE_GROUP="${2:-Interactive-CRM-Dev}"

echo "================================"
echo "EMAF Service Quick Deployment"
echo "================================"
echo "Function App: $FUNCTION_APP_NAME"
echo "Resource Group: $RESOURCE_GROUP"
echo "================================"
echo ""

cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install
echo ""

# Build the project
echo "🔨 Building TypeScript project..."
npm run build
echo ""

# Deploy to Azure
echo "🚀 Deploying to Azure Functions..."
func azure functionapp publish $FUNCTION_APP_NAME --typescript

echo ""
echo "✅ Deployment completed successfully!"
echo "📝 Function App URL: https://$FUNCTION_APP_NAME.azurewebsites.net"
echo ""
