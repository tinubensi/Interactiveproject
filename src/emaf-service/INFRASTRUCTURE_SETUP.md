# EMAF Service Infrastructure Setup

## Azure Resources Required

1. Cosmos DB Database and Containers
2. Azure Storage Queue
3. Azure Blob Storage Container
4. Event Grid Topic (shared with other services)

## Setup Script

```bash
#!/bin/bash

# Variables
RESOURCE_GROUP="crm-resource-group"
LOCATION="uaenorth"
COSMOS_ACCOUNT="crm-cosmos-account"
STORAGE_ACCOUNT="crmstorageaccount"
EVENTGRID_TOPIC="interactive-crm-eventgrid"

# 1. Create Cosmos DB Database
echo "Creating Cosmos DB database..."
az cosmosdb sql database create \
  --account-name $COSMOS_ACCOUNT \
  --name emaf-service-db \
  --resource-group $RESOURCE_GROUP

# 2. Create Cosmos DB Containers
echo "Creating emaf-templates container..."
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name emaf-service-db \
  --name emaf-templates \
  --partition-key-path /vendorId \
  --throughput 400 \
  --resource-group $RESOURCE_GROUP

echo "Creating emaf-submissions container..."
az cosmosdb sql container create \
  --account-name $COSMOS_ACCOUNT \
  --database-name emaf-service-db \
  --name emaf-submissions \
  --partition-key-path /leadId \
  --throughput 400 \
  --resource-group $RESOURCE_GROUP

# 3. Create Storage Queue
echo "Creating PDF generation queue..."
az storage queue create \
  --name pdf-generation-queue \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP

# 4. Create Blob Container
echo "Creating blob container for documents..."
az storage container create \
  --name emaf-documents \
  --account-name $STORAGE_ACCOUNT \
  --public-access off \
  --resource-group $RESOURCE_GROUP

# 5. Get Connection Strings
echo "Getting connection strings..."
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

EVENTGRID_ENDPOINT=$(az eventgrid topic show \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --query endpoint \
  --output tsv)

EVENTGRID_KEY=$(az eventgrid topic key list \
  --name $EVENTGRID_TOPIC \
  --resource-group $RESOURCE_GROUP \
  --query key1 \
  --output tsv)

# 6. Output Configuration
echo ""
echo "=== Configuration for local.settings.json ==="
echo "COSMOS_CONNECTION_STRING=$COSMOS_CONNECTION"
echo "BLOB_STORAGE_CONNECTION_STRING=$STORAGE_CONNECTION"
echo "EVENT_GRID_TOPIC_ENDPOINT=$EVENTGRID_ENDPOINT"
echo "EVENT_GRID_TOPIC_KEY=$EVENTGRID_KEY"
echo ""
echo "Setup complete!"
```

## Manual Setup Steps

### 1. Cosmos DB

```bash
# Create database
az cosmosdb sql database create \
  --account-name crm-cosmos-account \
  --name emaf-service-db \
  --resource-group crm-resource-group

# Create emaf-templates container
az cosmosdb sql container create \
  --account-name crm-cosmos-account \
  --database-name emaf-service-db \
  --name emaf-templates \
  --partition-key-path /vendorId \
  --throughput 400 \
  --resource-group crm-resource-group

# Create emaf-submissions container
az cosmosdb sql container create \
  --account-name crm-cosmos-account \
  --database-name emaf-service-db \
  --name emaf-submissions \
  --partition-key-path /leadId \
  --throughput 400 \
  --resource-group crm-resource-group
```

### 2. Storage Queue

```bash
# Create queue
az storage queue create \
  --name pdf-generation-queue \
  --account-name crmstorageaccount \
  --resource-group crm-resource-group
```

### 3. Blob Storage

```bash
# Create container
az storage container create \
  --name emaf-documents \
  --account-name crmstorageaccount \
  --public-access off \
  --resource-group crm-resource-group
```

### 4. Event Grid Subscription (Optional)

If you want pipeline service to listen to EMAF events:

```bash
az eventgrid event-subscription create \
  --name emaf-events-subscription \
  --source-resource-id /subscriptions/{subscription-id}/resourceGroups/crm-resource-group/providers/Microsoft.EventGrid/topics/interactive-crm-eventgrid \
  --endpoint https://pipeline-service.azurewebsites.net/api/events/emaf \
  --endpoint-type webhook \
  --included-event-types emaf.submission.submitted emaf.submission.approved emaf.submission.rejected
```

## Local Development Setup

For local development using Azurite:

```bash
# Start Azurite
azurite --silent --location c:\azurite --debug c:\azurite\debug.log

# Create local queue
az storage queue create \
  --name pdf-generation-queue \
  --connection-string "UseDevelopmentStorage=true"

# Create local blob container
az storage container create \
  --name emaf-documents \
  --connection-string "UseDevelopmentStorage=true"
```

## Verification

### Check Cosmos DB
```bash
# List databases
az cosmosdb sql database list \
  --account-name crm-cosmos-account \
  --resource-group crm-resource-group

# List containers
az cosmosdb sql container list \
  --account-name crm-cosmos-account \
  --database-name emaf-service-db \
  --resource-group crm-resource-group
```

### Check Storage Queue
```bash
# List queues
az storage queue list \
  --account-name crmstorageaccount
```

### Check Blob Container
```bash
# List containers
az storage container list \
  --account-name crmstorageaccount
```

## Cost Estimation

- **Cosmos DB**: ~$24/month (400 RU/s per container)
- **Storage Queue**: ~$0.01/month (minimal cost)
- **Blob Storage**: ~$0.02/GB/month
- **Event Grid**: ~$0.60 per million operations

Total estimated cost: ~$50-100/month depending on usage

## Security Considerations

1. **Cosmos DB**: Enable IP firewall rules
2. **Blob Storage**: Disable public access, use SAS tokens
3. **Storage Queue**: Use connection string, not access keys
4. **Event Grid**: Use managed identity or keys

## Backup Strategy

1. **Cosmos DB**: Enable automatic backup (enabled by default)
2. **Blob Storage**: Enable soft delete and versioning
3. **Configuration**: Store in Azure Key Vault

## Monitoring

### Application Insights
```bash
# Create Application Insights
az monitor app-insights component create \
  --app emaf-service-insights \
  --location uaenorth \
  --resource-group crm-resource-group
```

### Alerts
- Queue length > 100 items
- Failed function executions > 5% 
- Cosmos DB RU/s consumption > 80%
- Blob storage errors
