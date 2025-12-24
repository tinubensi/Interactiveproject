#!/bin/bash
set -e

# Deploy Infrastructure Script
# This script deploys the Bicep infrastructure to Azure

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
ENVIRONMENT=${1:-dev}
SUBSCRIPTION=${2}

echo "================================================"
echo "Deploying Nectaria Infrastructure"
echo "================================================"
echo "Environment: $ENVIRONMENT"
echo "Infra Directory: $INFRA_DIR"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI is not installed. Please install it first."
    echo "   Visit: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
echo "🔐 Checking Azure login status..."
if ! az account show &>/dev/null; then
    echo "❌ Not logged in to Azure. Running az login..."
    az login
fi

# Set subscription if provided
if [ -n "$SUBSCRIPTION" ]; then
    echo "🔧 Setting subscription to: $SUBSCRIPTION"
    az account set --subscription "$SUBSCRIPTION"
fi

# Display current subscription
CURRENT_SUB=$(az account show --query name -o tsv)
CURRENT_SUB_ID=$(az account show --query id -o tsv)
echo "✅ Using subscription: $CURRENT_SUB ($CURRENT_SUB_ID)"
echo ""

# Check if parameter file exists
PARAM_FILE="$INFRA_DIR/parameters.${ENVIRONMENT}.json"
if [ ! -f "$PARAM_FILE" ]; then
    echo "❌ Parameter file not found: $PARAM_FILE"
    echo "   Available parameter files:"
    ls -1 "$INFRA_DIR"/parameters.*.json 2>/dev/null || echo "   None found"
    exit 1
fi

echo "📋 Using parameter file: $PARAM_FILE"
echo ""

# Extract location from parameters file
LOCATION=$(jq -r '.parameters.location.value' "$PARAM_FILE")
if [ -z "$LOCATION" ] || [ "$LOCATION" = "null" ]; then
    LOCATION="uaenorth"  # Default fallback
    echo "⚠️  No location found in parameters, using default: $LOCATION"
else
    echo "📍 Deployment location: $LOCATION"
fi
echo ""

# Validate Bicep template
echo "🔍 Validating Bicep template..."
if az deployment sub validate \
    --location "$LOCATION" \
    --template-file "$INFRA_DIR/main.bicep" \
    --parameters "@$PARAM_FILE" \
    --output none; then
    echo "✅ Template validation successful"
else
    echo "❌ Template validation failed"
    exit 1
fi
echo ""

# Confirm deployment
echo "⚠️  This will deploy/update infrastructure in Azure."
echo "   Environment: $ENVIRONMENT"
echo "   Location: $LOCATION"
echo "   Subscription: $CURRENT_SUB"
echo ""
read -p "Do you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    echo "❌ Deployment cancelled"
    exit 0
fi
echo ""

# Deploy infrastructure
DEPLOYMENT_NAME="nectaria-$ENVIRONMENT-$(date +%Y%m%d-%H%M%S)"
echo "🚀 Starting deployment: $DEPLOYMENT_NAME"
echo "🌍 Deploying to location: $LOCATION"
echo ""

if az deployment sub create \
    --name "$DEPLOYMENT_NAME" \
    --location "$LOCATION" \
    --template-file "$INFRA_DIR/main.bicep" \
    --parameters "@$PARAM_FILE" \
    --output json > "$INFRA_DIR/deployment-output.json"; then
    
    echo ""
    echo "✅ Infrastructure deployment successful!"
    echo ""
    
    # Display outputs
    echo "================================================"
    echo "Deployment Outputs"
    echo "================================================"
    
    RESOURCE_GROUP=$(jq -r '.properties.outputs.resourceGroupName.value' "$INFRA_DIR/deployment-output.json")
    COSMOS_ENDPOINT=$(jq -r '.properties.outputs.cosmosDbEndpoint.value' "$INFRA_DIR/deployment-output.json")
    EVENT_GRID_ENDPOINT=$(jq -r '.properties.outputs.eventGridTopicEndpoint.value' "$INFRA_DIR/deployment-output.json")
    KEY_VAULT_NAME=$(jq -r '.properties.outputs.keyVaultName.value' "$INFRA_DIR/deployment-output.json")
    
    echo "Resource Group: $RESOURCE_GROUP"
    echo "Cosmos DB Endpoint: $COSMOS_ENDPOINT"
    echo "Event Grid Endpoint: $EVENT_GRID_ENDPOINT"
    echo "Key Vault Name: $KEY_VAULT_NAME"
    echo ""
    
    echo "Function Apps:"
    jq -r '.properties.outputs.functionApps.value[] | "  - \(.serviceName): \(.url)"' "$INFRA_DIR/deployment-output.json"
    echo ""
    
    echo "================================================"
    echo "Next Steps"
    echo "================================================"
    echo "1. Run post-deployment script to configure secrets:"
    echo "   ./infra/scripts/post-deployment.sh $ENVIRONMENT"
    echo ""
    echo "2. Deploy function app code:"
    echo "   Run Azure DevOps pipeline or deploy manually"
    echo ""
    
else
    echo ""
    echo "❌ Infrastructure deployment failed"
    echo "Check the error messages above for details"
    exit 1
fi

