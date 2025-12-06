#!/bin/bash

# Azure Event Grid Topic Setup Script
# Creates a centralized Event Grid topic for Interactive CRM microservices

set -e

# Configuration
RESOURCE_GROUP="Interactive-CRM-Dev"
LOCATION="uaenorth"
EVENTGRID_TOPIC="interactive-crm-eventgrid"

echo "================================"
echo "Azure Event Grid Setup"
echo "================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Topic Name: $EVENTGRID_TOPIC"
echo "================================"
echo ""

# Check if logged in to Azure
if ! az account show > /dev/null 2>&1; then
    echo "❌ Not logged in to Azure. Please login first:"
    echo "   az login"
    exit 1
fi

# Display current Azure subscription
SUBSCRIPTION_NAME=$(az account show --query name -o tsv)
echo "✓ Logged in to Azure"
echo "  Subscription: $SUBSCRIPTION_NAME"
echo ""

# Check if resource group exists
echo "📦 Checking if resource group exists..."
if az group show --name $RESOURCE_GROUP > /dev/null 2>&1; then
    echo "✓ Resource group '$RESOURCE_GROUP' found"
else
    echo "❌ Resource group '$RESOURCE_GROUP' not found"
    echo "   Please create the resource group first:"
    echo "   az group create --name $RESOURCE_GROUP --location $LOCATION"
    exit 1
fi
echo ""

# Check if Event Grid topic already exists
echo "🔍 Checking if Event Grid topic already exists..."
if az eventgrid topic show --name $EVENTGRID_TOPIC --resource-group $RESOURCE_GROUP > /dev/null 2>&1; then
    echo "⚠️  Event Grid topic '$EVENTGRID_TOPIC' already exists"
    echo ""
    echo "To view existing topic details, run:"
    echo "  az eventgrid topic show --name $EVENTGRID_TOPIC --resource-group $RESOURCE_GROUP"
    echo ""
    echo "To retrieve endpoint and keys from Azure Portal:"
    echo "  1. Go to Azure Portal (https://portal.azure.com)"
    echo "  2. Navigate to Resource Groups > $RESOURCE_GROUP"
    echo "  3. Select '$EVENTGRID_TOPIC'"
    echo "  4. Go to 'Access keys' to get the endpoint and keys"
    exit 0
fi
echo ""

# Create Event Grid Topic
echo "📡 Creating Event Grid topic..."
az eventgrid topic create \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

echo ""
echo "✅ Event Grid topic created successfully!"
echo ""
echo "================================"
echo "Next Steps"
echo "================================"
echo ""
echo "1. Retrieve the endpoint and keys from Azure Portal:"
echo "   - Go to: https://portal.azure.com"
echo "   - Navigate to: Resource Groups > $RESOURCE_GROUP > $EVENTGRID_TOPIC"
echo "   - Click on: 'Access keys'"
echo ""
echo "2. Add these environment variables to all your services:"
echo "   EVENT_GRID_TOPIC_ENDPOINT=<Topic Endpoint>"
echo "   EVENT_GRID_TOPIC_KEY=<Key 1 or Key 2>"
echo ""
echo "3. Services that will use this Event Grid:"
echo "   - Lead Service"
echo "   - Policy Service"
echo "   - Quotation Service"
echo "   - Customer Service"
echo "   - Document Service"
echo "   - Form Service"
echo "   - Workflow Service"
echo ""
echo "================================"


