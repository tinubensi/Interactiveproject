#!/bin/bash

# Load environment variables from local.settings.json and run the seed script

# IMPORTANT: Set these environment variables before running this script
# You can get these values from Azure Portal or local.settings.json
if [ -z "$COSMOS_CONNECTION_STRING" ]; then
  echo "❌ Error: COSMOS_CONNECTION_STRING environment variable is not set"
  echo "Please set it using: export COSMOS_CONNECTION_STRING='<your-connection-string>'"
  exit 1
fi

export COSMOS_DATABASE_NAME="${COSMOS_DATABASE_NAME:-emaf-service-db}"
export COSMOS_TEMPLATES_CONTAINER="${COSMOS_TEMPLATES_CONTAINER:-emaf-templates}"
export COSMOS_SUBMISSIONS_CONTAINER="${COSMOS_SUBMISSIONS_CONTAINER:-emaf-submissions}"
export BLOB_CONTAINER_NAME="${BLOB_CONTAINER_NAME:-emaf-documents}"

echo "🌱 Running Al Sagr EMAF Template Seed Script..."
echo "📊 Using Cosmos DB: emaf-service-db"
echo ""

# Build and run the seed script
npm run build && node dist/src/scripts/seed-alsagr-template.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ Seed script completed successfully!"
else
    echo ""
    echo "❌ Seed script failed with exit code: $exit_code"
fi

exit $exit_code
