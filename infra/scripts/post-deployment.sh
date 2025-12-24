#!/bin/bash
set -e

# Post-Deployment Script
# This script configures secrets in Key Vault after infrastructure deployment

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Configuration
ENVIRONMENT=${1:-dev}
DEPLOYMENT_OUTPUT="$INFRA_DIR/deployment-output.json"

echo "================================================"
echo "Post-Deployment Configuration"
echo "================================================"
echo "Environment: $ENVIRONMENT"
echo ""

# Check if deployment output exists
if [ ! -f "$DEPLOYMENT_OUTPUT" ]; then
    echo "❌ Deployment output file not found: $DEPLOYMENT_OUTPUT"
    echo "   Run deploy-infra.sh first"
    exit 1
fi

# Extract values from deployment output
KEY_VAULT_NAME=$(jq -r '.properties.outputs.keyVaultName.value' "$DEPLOYMENT_OUTPUT")
COSMOS_ACCOUNT_NAME=$(jq -r '.properties.outputs.cosmosDbAccountName.value' "$DEPLOYMENT_OUTPUT")
RESOURCE_GROUP=$(jq -r '.properties.outputs.resourceGroupName.value' "$DEPLOYMENT_OUTPUT")
EVENT_GRID_TOPIC_NAME=$(jq -r '.properties.outputs.eventGridTopicName.value' "$DEPLOYMENT_OUTPUT")

# Validate extracted values
echo "🔍 Validating deployment output..."
VALIDATION_FAILED=false

if [ -z "$KEY_VAULT_NAME" ] || [ "$KEY_VAULT_NAME" = "null" ]; then
    echo "❌ Failed to extract Key Vault name from deployment output"
    VALIDATION_FAILED=true
fi

if [ -z "$COSMOS_ACCOUNT_NAME" ] || [ "$COSMOS_ACCOUNT_NAME" = "null" ]; then
    echo "❌ Failed to extract Cosmos DB account name from deployment output"
    VALIDATION_FAILED=true
fi

if [ -z "$RESOURCE_GROUP" ] || [ "$RESOURCE_GROUP" = "null" ]; then
    echo "❌ Failed to extract Resource Group name from deployment output"
    VALIDATION_FAILED=true
fi

if [ -z "$EVENT_GRID_TOPIC_NAME" ] || [ "$EVENT_GRID_TOPIC_NAME" = "null" ]; then
    echo "❌ Failed to extract Event Grid topic name from deployment output"
    VALIDATION_FAILED=true
fi

if [ "$VALIDATION_FAILED" = true ]; then
    echo ""
    echo "❌ Deployment output validation failed!"
    echo "   The deployment output file may be corrupted or have an unexpected structure."
    echo "   File: $DEPLOYMENT_OUTPUT"
    echo ""
    echo "Expected structure:"
    echo "  .properties.outputs.keyVaultName.value"
    echo "  .properties.outputs.cosmosDbAccountName.value"
    echo "  .properties.outputs.resourceGroupName.value"
    echo "  .properties.outputs.eventGridTopicName.value"
    echo ""
    exit 1
fi

echo "✅ Deployment output validated successfully"
echo ""
echo "📋 Configuration Details:"
echo "   Key Vault: $KEY_VAULT_NAME"
echo "   Cosmos DB: $COSMOS_ACCOUNT_NAME"
echo "   Resource Group: $RESOURCE_GROUP"
echo "   Event Grid Topic: $EVENT_GRID_TOPIC_NAME"
echo ""

# Check Azure login
if ! az account show &>/dev/null; then
    echo "❌ Not logged in to Azure"
    exit 1
fi

echo "🔑 Configuring Key Vault Secrets..."
echo ""

# 1. Get Cosmos DB Primary Key
echo "1/5 Retrieving Cosmos DB key..."
COSMOS_KEY=$(az cosmosdb keys list \
    --name "$COSMOS_ACCOUNT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --type keys \
    --query primaryMasterKey -o tsv)

if [ -n "$COSMOS_KEY" ]; then
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "cosmos-key" \
        --value "$COSMOS_KEY" \
        --output none
    echo "   ✅ cosmos-key stored"
else
    echo "   ❌ Failed to retrieve Cosmos DB key"
fi

# 2. Get Event Grid Topic Key
echo "2/5 Retrieving Event Grid topic key..."
EVENT_GRID_KEY=$(az eventgrid topic key list \
    --name "$EVENT_GRID_TOPIC_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query key1 -o tsv)

if [ -n "$EVENT_GRID_KEY" ]; then
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "event-grid-topic-key" \
        --value "$EVENT_GRID_KEY" \
        --output none
    echo "   ✅ event-grid-topic-key stored"
else
    echo "   ❌ Failed to retrieve Event Grid key"
fi

# 3. Generate Internal Service Key
echo "3/5 Generating internal service key..."
INTERNAL_SERVICE_KEY=$(openssl rand -base64 32)
az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "internal-service-key" \
    --value "$INTERNAL_SERVICE_KEY" \
    --output none
echo "   ✅ internal-service-key generated and stored"

# 4. Generate JWT Secret
echo "4/5 Generating JWT secret..."
JWT_SECRET=$(openssl rand -base64 32)
az keyvault secret set \
    --vault-name "$KEY_VAULT_NAME" \
    --name "jwt-secret" \
    --value "$JWT_SECRET" \
    --output none
echo "   ✅ jwt-secret generated and stored"

# 5. Azure AD Client Secret (manual input required)
echo "5/5 Configuring Azure AD client secret..."
echo ""
echo "⚠️  Azure AD client secret must be provided manually."
echo "   This is the secret you created in Azure AD App Registration."
echo ""
read -p "Enter Azure AD Client Secret (or press Enter to skip): " AZURE_AD_SECRET

if [ -n "$AZURE_AD_SECRET" ]; then
    az keyvault secret set \
        --vault-name "$KEY_VAULT_NAME" \
        --name "azure-ad-client-secret" \
        --value "$AZURE_AD_SECRET" \
        --output none
    echo "   ✅ azure-ad-client-secret stored"
else
    echo "   ⚠️  Skipped. You can add it later with:"
    echo "      az keyvault secret set --vault-name $KEY_VAULT_NAME --name azure-ad-client-secret --value <YOUR-SECRET>"
fi

echo ""
echo "================================================"
echo "Configuration Summary"
echo "================================================"
echo "✅ Secrets configured in Key Vault: $KEY_VAULT_NAME"
echo ""
echo "Configured Secrets:"
echo "  ✅ cosmos-key"
echo "  ✅ event-grid-topic-key"
echo "  ✅ internal-service-key"
echo "  ✅ jwt-secret"
if [ -n "$AZURE_AD_SECRET" ]; then
    echo "  ✅ azure-ad-client-secret"
else
    echo "  ⚠️  azure-ad-client-secret (not configured)"
fi
echo ""

# Display connection information
echo "================================================"
echo "Connection Information"
echo "================================================"
echo ""
echo "For local development, update your local.settings.json:"
echo ""
echo "COSMOS_ENDPOINT=$(jq -r '.properties.outputs.cosmosDbEndpoint.value' "$DEPLOYMENT_OUTPUT")"
echo "COSMOS_KEY=<from Key Vault>"
echo "EVENT_GRID_TOPIC_ENDPOINT=$(jq -r '.properties.outputs.eventGridTopicEndpoint.value' "$DEPLOYMENT_OUTPUT")"
echo "INTERNAL_SERVICE_KEY=<from Key Vault>"
echo "JWT_SECRET=<from Key Vault>"
echo ""

# Save configuration to file
CONFIG_FILE="$INFRA_DIR/${ENVIRONMENT}-config.txt"
cat > "$CONFIG_FILE" <<EOF
Nectaria Infrastructure Configuration
Environment: $ENVIRONMENT
Deployed: $(date)

Resource Group: $RESOURCE_GROUP
Key Vault: $KEY_VAULT_NAME
Cosmos DB Account: $COSMOS_ACCOUNT_NAME

Cosmos DB Endpoint: $(jq -r '.properties.outputs.cosmosDbEndpoint.value' "$DEPLOYMENT_OUTPUT")
Event Grid Endpoint: $(jq -r '.properties.outputs.eventGridTopicEndpoint.value' "$DEPLOYMENT_OUTPUT")
Key Vault URI: $(jq -r '.properties.outputs.keyVaultUri.value' "$DEPLOYMENT_OUTPUT")

Function Apps:
$(jq -r '.properties.outputs.functionApps.value[] | "  - \(.serviceName): \(.functionAppName)"' "$DEPLOYMENT_OUTPUT")

To retrieve secrets from Key Vault:
  az keyvault secret show --vault-name $KEY_VAULT_NAME --name <secret-name> --query value -o tsv
EOF

echo "📝 Configuration saved to: $CONFIG_FILE"
echo ""
echo "✅ Post-deployment configuration complete!"

