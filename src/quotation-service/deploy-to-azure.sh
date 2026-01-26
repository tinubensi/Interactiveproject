#!/bin/bash

# Azure Function App Deployment Script
# This script deploys the quotation service using Kudu REST API

FUNCTION_APP_NAME="quotation-service-74e1210c"
ZIP_FILE="deploy-fixed.zip"

echo "🚀 Deploying to Azure Function App: $FUNCTION_APP_NAME"
echo ""

# Get publish profile credentials from user
echo "Please provide your Azure Function App publish credentials:"
echo "(You can find these in Azure Portal > Function App > Get publish profile)"
echo ""
read -p "Username (e.g., \$quotation-service...): " USERNAME
read -sp "Password: " PASSWORD
echo ""
echo ""

# Deploy using Kudu ZipDeploy API
echo "📦 Uploading deployment package..."
KUDU_URL="https://$FUNCTION_APP_NAME.scm.azurewebsites.net/api/zipdeploy"

HTTP_CODE=$(curl -X POST \
  -u "$USERNAME:$PASSWORD" \
  -H "Content-Type: application/zip" \
  --data-binary "@$ZIP_FILE" \
  -w "%{http_code}" \
  -o deploy-response.txt \
  "$KUDU_URL")

echo ""
echo "HTTP Response Code: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "202" ]; then
    echo "✅ Deployment successful!"
    echo ""
    echo "🔍 Verifying deployment..."
    sleep 5
    
    # List functions
    curl -s -u "$USERNAME:$PASSWORD" \
      "https://$FUNCTION_APP_NAME.scm.azurewebsites.net/api/functions" \
      | grep -o '"name":"[^"]*"' \
      | cut -d'"' -f4
    
    echo ""
    echo "✅ Deployment complete!"
else
    echo "❌ Deployment failed!"
    echo "Response:"
    cat deploy-response.txt
    exit 1
fi

rm -f deploy-response.txt
