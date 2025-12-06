#!/bin/bash

# Setup Script: Cosmos DB Indexes for Workflow Service
# This script adds composite indexes to the workflow-instances container
# for efficient lead-based queries.

# Prerequisites:
# - Azure CLI installed and logged in
# - Cosmos DB account already created

set -e

# Configuration (update these values)
RESOURCE_GROUP="${RESOURCE_GROUP:-nectaria-rg}"
COSMOS_ACCOUNT="${COSMOS_ACCOUNT:-nectaria-cosmos}"
DATABASE_NAME="${DATABASE_NAME:-workflow-db}"
CONTAINER_NAME="${CONTAINER_NAME:-workflow-instances}"

echo "Setting up Cosmos DB indexes for workflow service..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Cosmos Account: $COSMOS_ACCOUNT"
echo "Database: $DATABASE_NAME"
echo "Container: $CONTAINER_NAME"

# Get current indexing policy
echo "Fetching current indexing policy..."
CURRENT_POLICY=$(az cosmosdb sql container show \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$COSMOS_ACCOUNT" \
  --database-name "$DATABASE_NAME" \
  --name "$CONTAINER_NAME" \
  --query "resource.indexingPolicy" \
  --output json)

echo "Current policy:"
echo "$CURRENT_POLICY" | jq .

# Create new indexing policy with composite indexes for leadId queries
NEW_POLICY=$(cat <<'EOF'
{
  "indexingMode": "consistent",
  "automatic": true,
  "includedPaths": [
    {
      "path": "/*"
    }
  ],
  "excludedPaths": [
    {
      "path": "/_etag/?"
    },
    {
      "path": "/activityLog/*"
    }
  ],
  "compositeIndexes": [
    [
      { "path": "/leadId", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ],
    [
      { "path": "/leadId", "order": "ascending" },
      { "path": "/status", "order": "ascending" }
    ],
    [
      { "path": "/organizationId", "order": "ascending" },
      { "path": "/leadId", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ],
    [
      { "path": "/organizationId", "order": "ascending" },
      { "path": "/status", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ],
    [
      { "path": "/organizationId", "order": "ascending" },
      { "path": "/lineOfBusiness", "order": "ascending" },
      { "path": "/createdAt", "order": "descending" }
    ]
  ]
}
EOF
)

echo ""
echo "New indexing policy with composite indexes:"
echo "$NEW_POLICY" | jq .

# Apply the new indexing policy
echo ""
echo "Applying new indexing policy..."
az cosmosdb sql container update \
  --resource-group "$RESOURCE_GROUP" \
  --account-name "$COSMOS_ACCOUNT" \
  --database-name "$DATABASE_NAME" \
  --name "$CONTAINER_NAME" \
  --idx "$NEW_POLICY"

echo ""
echo "✓ Indexing policy updated successfully!"
echo ""
echo "The following composite indexes have been added:"
echo "  1. leadId + createdAt (DESC) - For getting latest instance by lead"
echo "  2. leadId + status - For filtering active instances by lead"
echo "  3. organizationId + leadId + createdAt - For org-scoped lead queries"
echo "  4. organizationId + status + createdAt - For listing active instances"
echo "  5. organizationId + lineOfBusiness + createdAt - For filtering by LOB"
echo ""
echo "Note: Index rebuilding may take some time depending on data volume."

