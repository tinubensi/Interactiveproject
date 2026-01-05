# Enhanced Pipeline Deployment Guide

This guide covers the complete deployment process for the enhanced pipeline architecture with configuration-driven hybrid sync/async actions.

## 📋 Prerequisites

Before deploying, ensure you have:

- ✅ Azure CLI installed and authenticated (`az login`)
- ✅ Node.js 18+ installed
- ✅ All services built successfully
- ✅ Azure Functions Core Tools installed (`func` command)
- ✅ Access to Azure subscription with appropriate permissions
- ✅ Environment variables configured for all services

## 🏗️ Architecture Overview

The enhanced pipeline uses:

- **Configuration-driven actions**: Pipeline definitions specify sync/async actions
- **Event Grid routing**: `pipeline.action.*` events → Services, `service.*.completed` events → Pipeline
- **HTTP fallback**: Critical events have HTTP fallback for reliability
- **Service handlers**: Each service has Event Grid handlers for pipeline actions

## 🚀 Deployment Steps

### Step 1: Verify Environment

```bash
# Check Azure CLI authentication
az account show

# Check subscription and resource group
export SUBSCRIPTION_ID=$(az account show --query id -o tsv)
export RESOURCE_GROUP="nectaria-rg-dev"
export REGION="uaenorth"

echo "Subscription: $SUBSCRIPTION_ID"
echo "Resource Group: $RESOURCE_GROUP"
echo "Region: $REGION"
```

### Step 2: Build All Services

```bash
cd /home/aravind/Projects/nectaria/nectaria-services

# Build pipeline service
cd src/pipeline-service
npm install
npm run build
cd ../..

# Build quotation-generation-service
cd src/quotation-generation-service
npm install
npm run build
cd ../..

# Build quotation-service
cd src/quotation-service
npm install
npm run build
cd ../..

# Build policy-service
cd src/policy-service
npm install
npm run build
cd ../..
```

### Step 3: Deploy Services to Azure

```bash
# Deploy quotation-generation-service (with new handlePipelineAction)
cd src/quotation-generation-service
func azure functionapp publish func-nectaria-quotation-gen-dev --typescript
cd ../..

# Deploy quotation-service (with new handlePipelineAction)
cd src/quotation-service
func azure functionapp publish func-nectaria-quotation-dev --typescript
cd ../..

# Deploy policy-service (with new handlePipelineAction)
cd src/policy-service
func azure functionapp publish func-nectaria-policy-dev --typescript
cd ../..

# Deploy pipeline-service (with updated orchestrator)
cd src/pipeline-service
func azure functionapp publish func-nectaria-pipeline-dev --typescript
cd ../..
```

**Expected Output**: Each deployment should show `✓ Function app deployed successfully`

### Step 4: Clean Existing Pipeline Data

⚠️ **WARNING**: This will delete all existing pipeline instances and old pipeline definitions.

```bash
cd src/pipeline-service

# Run cleanup with --force flag
npx ts-node scripts/clean-pipeline-data.ts --force
```

**Expected Output**:
```
Pipeline instances deleted: X
Pipeline definitions deleted: Y
✓ Cleanup completed successfully!
```

### Step 5: Seed Enhanced Pipeline Definition

```bash
cd src/pipeline-service

# Run seed script
npx ts-node scripts/seedEnhancedPipeline.ts
```

**Expected Output**:
```
✓ Pipeline generated: Medical Insurance Pipeline v2 (Enhanced)
✓ Pipeline validation passed
✓ Pipeline created successfully in database
✓ Enhanced Medical pipeline seeded successfully!
```

### Step 6: Setup Event Grid Subscriptions

```bash
cd /home/aravind/Projects/nectaria/nectaria-services

# Make script executable (if not already)
chmod +x scripts/setup-enhanced-pipeline-subscriptions.sh

# Run Event Grid setup
./scripts/setup-enhanced-pipeline-subscriptions.sh
```

**Expected Output**:
```
✓ Subscription created: action-fetch-plans
✓ Subscription created: action-send-quotation
✓ Subscription created: action-issue-policy
✓ Subscription created: service-completions-to-pipeline
✓ Event Grid Setup Complete!
```

### Step 7: Verify Deployment

#### 7.1 Check Function Apps Status

```bash
# List all function apps
az functionapp list --resource-group $RESOURCE_GROUP --output table

# Check pipeline service functions
az functionapp function list \
  --resource-group $RESOURCE_GROUP \
  --name func-nectaria-pipeline-dev \
  --output table
```

#### 7.2 Check Event Grid Subscriptions

```bash
# List Event Grid subscriptions
az eventgrid event-subscription list \
  --source-resource-id "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/nectaria-eventgrid-topic-dev" \
  --output table
```

**Expected Subscriptions**:
- `action-fetch-plans`
- `action-send-quotation`
- `action-issue-policy`
- `service-completions-to-pipeline`

#### 7.3 Verify Pipeline Definition

```bash
# Query Cosmos DB for enhanced pipeline
az cosmosdb sql query \
  --account-name nectaria-cosmos-dev \
  --resource-group $RESOURCE_GROUP \
  --database-name nectaria-db \
  --container-name pipeline-definitions \
  --query-text "SELECT * FROM c WHERE c.version = 2"
```

### Step 8: Test End-to-End Flow

#### 8.1 Create Test Lead

```bash
# Get Lead Service URL
LEAD_SERVICE_URL=$(az functionapp show \
  --resource-group $RESOURCE_GROUP \
  --name func-nectaria-lead-dev \
  --query defaultHostName -o tsv)

# Create lead
curl -X POST "https://$LEAD_SERVICE_URL/api/leads" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "test-customer-123",
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "formId": "medical-form-v1",
    "formData": {},
    "lobData": {
      "dateOfBirth": "1990-01-01",
      "gender": "male",
      "nationality": "UAE"
    }
  }'
```

**Expected Response**: Lead created with ID and referenceId

#### 8.2 Check Pipeline Instance Creation

```bash
# Get Pipeline Service URL
PIPELINE_SERVICE_URL=$(az functionapp show \
  --resource-group $RESOURCE_GROUP \
  --name func-nectaria-pipeline-dev \
  --query defaultHostName -o tsv)

# Check pipeline instance (replace LEAD_ID)
curl "https://$PIPELINE_SERVICE_URL/api/pipeline/check/{LEAD_ID}"
```

**Expected Response**:
```json
{
  "instanceId": "...",
  "leadId": "...",
  "currentStageName": "Lead Created",
  "progressPercent": 10,
  "status": "active"
}
```

#### 8.3 Wait for Plans Available

Wait 2-3 minutes for plan fetching to complete, then check again:

```bash
curl "https://$PIPELINE_SERVICE_URL/api/pipeline/check/{LEAD_ID}"
```

**Expected Response**:
```json
{
  "currentStageName": "Plans Available",
  "progressPercent": 30,
  "status": "active"
}
```

### Step 9: Monitor Logs

#### 9.1 Pipeline Service Logs

```bash
az functionapp logs tail \
  --resource-group $RESOURCE_GROUP \
  --name func-nectaria-pipeline-dev
```

**Look for**:
- `[PIPELINE ACTION] fetch_plans`
- `[ASYNC ACTION] Event published: pipeline.action.fetch_plans`
- `[SERVICE COMPLETION] Received service.fetch_plans.completed`

#### 9.2 Quotation Generation Service Logs

```bash
az functionapp logs tail \
  --resource-group $RESOURCE_GROUP \
  --name func-nectaria-quotation-gen-dev
```

**Look for**:
- `[PIPELINE ACTION] fetch_plans for lead`
- `[PIPELINE ACTION] ✓ fetch_plans completed successfully`

### Step 10: Test Advanced Scenarios

#### 10.1 Test Quotation Creation

Use the frontend UI or API to create a quotation and verify:
- Pipeline advances to "Quotation Created"
- Email is sent automatically
- Pipeline advances to "Quotation Sent"

#### 10.2 Test Policy Issuance

Approve a quotation and verify:
- Pipeline advances to "Approved"
- Policy is issued automatically
- Pipeline advances to "Policy Issued"
- Pipeline status becomes "completed"

## 🧪 Running Tests

### Unit Tests

```bash
cd nectaria-services/src/pipeline-service
npm test
```

### Integration Tests

```bash
cd nectaria-services
npm run test:integration
```

### E2E Tests

```bash
cd nectaria-services
npm run test:e2e
```

## 🔧 Troubleshooting

### Issue: Pipeline instance not created

**Solution**:
1. Check if `lead.created` event was published to Event Grid
2. Check pipeline service logs for errors
3. Verify Event Grid subscription for `lead.created` exists
4. Check HTTP fallback notification

### Issue: Plans not fetched

**Solution**:
1. Check if `pipeline.action.fetch_plans` event was published
2. Check Event Grid subscription `action-fetch-plans` is active
3. Check quotation-generation-service logs
4. Verify `HandleFetchPlansAction` function exists and is registered

### Issue: Email not sent

**Solution**:
1. Check if `pipeline.action.send_quotation` event was published
2. Check Event Grid subscription `action-send-quotation` is active
3. Check quotation-service email service configuration
4. Verify SMTP credentials in environment variables

### Issue: Service completion event not received

**Solution**:
1. Check Event Grid subscription `service-completions-to-pipeline`
2. Verify completion event format matches expected schema
3. Check Event Grid metrics for failed deliveries
4. Check for Event Grid dead letter messages

### Issue: Old pipeline definition still active

**Solution**:
```bash
# Deactivate old pipelines
az cosmosdb sql query \
  --account-name nectaria-cosmos-dev \
  --resource-group $RESOURCE_GROUP \
  --database-name nectaria-db \
  --container-name pipeline-definitions \
  --query-text "SELECT * FROM c WHERE c.version = 1"

# Manually update isActive to false via Cosmos DB Data Explorer
```

## 📊 Monitoring

### Event Grid Metrics

```bash
# View Event Grid topic metrics
az monitor metrics list \
  --resource "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.EventGrid/topics/nectaria-eventgrid-topic-dev" \
  --metric "PublishSuccessCount,PublishFailCount,DeliverySuccessCount,DeliveryFailCount"
```

### Function App Metrics

```bash
# View Pipeline Service metrics
az monitor metrics list \
  --resource "/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.Web/sites/func-nectaria-pipeline-dev" \
  --metric "FunctionExecutionCount,FunctionExecutionUnits"
```

## 🔄 Rollback Procedure

If issues occur, rollback to previous version:

1. **Redeploy old service versions** (from git tag/branch)
2. **Reactivate old pipeline definitions**:
   ```bash
   # Update old pipeline to active
   # Use Cosmos DB Data Explorer or SDK
   ```
3. **Remove new Event Grid subscriptions**:
   ```bash
   az eventgrid event-subscription delete --name action-fetch-plans ...
   ```
4. **Restore old Event Grid subscriptions** (if changed)

## ✅ Success Criteria

Deployment is successful when:

- ✅ All 4 services deployed without errors
- ✅ Enhanced pipeline definition created (version 2)
- ✅ 4 Event Grid subscriptions active
- ✅ Test lead creation → Plans Available works end-to-end
- ✅ Quotation creation → Email sent works
- ✅ Policy issuance completes successfully
- ✅ All unit tests pass (90%+ coverage)
- ✅ Integration tests pass
- ✅ No critical errors in logs

## 📚 Next Steps

After successful deployment:

1. **Monitor production traffic** for 24-48 hours
2. **Collect metrics** on pipeline completion times
3. **Analyze Event Grid delivery success rates**
4. **Optimize action timeouts** based on real data
5. **Implement APIM integration** for sync API calls
6. **Add Durable Functions** for complex sagas
7. **Implement Zod validation** for pipeline definitions

## 🆘 Support

For issues or questions:
- Check logs in Azure Portal
- Review Event Grid delivery attempts
- Contact DevOps team for infrastructure issues
- Refer to architecture documentation in `/docs/ARCHITECTURE_CONTEXT.MD`

---

**Deployment Date**: _To be filled during deployment_  
**Deployed By**: _To be filled during deployment_  
**Version**: Enhanced Pipeline v2.0  
**Status**: _To be updated after verification_

