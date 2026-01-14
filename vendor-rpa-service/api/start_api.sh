#!/bin/bash

# Get Azure Storage connection string
export AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string \
  --name crmrpastorage36434 \
  --resource-group Interactive-CRM-Dev \
  --query connectionString \
  --output tsv)

export WEBHOOK_URL="http://localhost:8000/api/callback"

echo "Starting FastAPI with environment variables..."
echo "Storage: ${AZURE_STORAGE_CONNECTION_STRING:0:50}..."

cd /home/janees/Desktop/crm/vendor-rpa-service
source venv/bin/activate
cd api

python -m uvicorn main:app --host 0.0.0.0 --port 8000

