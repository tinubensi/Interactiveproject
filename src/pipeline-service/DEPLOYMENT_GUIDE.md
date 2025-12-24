# Deployment Guide - Hybrid Sync/Async Pipeline Architecture

This guide describes how to deploy the enhanced pipeline architecture to a development environment.

## Prerequisites

- Azure subscription with appropriate permissions
- Azure Functions Core Tools installed
- Azure CLI installed and configured
- All services built and tested locally
- Event Grid topic created and configured
- Cosmos DB databases set up for all services

## Pre-Deployment Checklist

- [ ] All code changes committed
- [ ] All tests passing locally
- [ ] Environment variables configured
- [ ] Event Grid topic created
- [ ] Cosmos DB containers created
- [ ] Service URLs documented
- [ ] Internal service key generated

## Deployment Steps

### 1. Deploy All Services Simultaneously

Since data loss is acceptable in dev, deploy all services at once:

```bash
# Deploy Pipeline Service
cd src/pipeline-service
func azure functionapp publish <pipeline-service-app-name>

# Deploy Quotation Generation Service
cd ../quotation-generation-service
func azure functionapp publish <quotation-gen-app-name>

# Deploy Quotation Service
cd ../quotation-service
func azure functionapp publish <quotation-service-app-name>

# Deploy Policy Service
cd ../policy-service
func azure functionapp publish <policy-service-app-name>

# Deploy Lead Service (if updated)
cd ../lead-service
func azure functionapp publish <lead-service-app-name>
```

### 2. Configure Environment Variables

Set the following environment variables for each service:

#### Pipeline Service
```bash
az functionapp config appsettings set \
  --name <pipeline-service-app-name> \
  --resource-group <resource-group> \
  --settings \
    LEAD_SERVICE_URL=https://<lead-service>.azurewebsites.net \
    QUOTATION_GEN_SERVICE_URL=https://<quotation-gen-service>.azurewebsites.net \
    QUOTATION_SERVICE_URL=https://<quotation-service>.azurewebsites.net \
    POLICY_SERVICE_URL=https://<policy-service>.azurewebsites.net \
    INTERNAL_SERVICE_KEY=<generated-key> \
    APIM_GATEWAY_URL=https://<apim-instance>.azure-api.net \
    EVENT_GRID_TOPIC_ENDPOINT=<event-grid-topic-endpoint> \
    EVENT_GRID_TOPIC_KEY=<event-grid-topic-key>
```

#### Quotation Generation Service
```bash
az functionapp config appsettings set \
  --name <quotation-gen-app-name> \
  --resource-group <resource-group> \
  --settings \
    EVENT_GRID_TOPIC_ENDPOINT=<event-grid-topic-endpoint> \
    EVENT_GRID_TOPIC_KEY=<event-grid-topic-key>
```

#### Quotation Service
```bash
az functionapp config appsettings set \
  --name <quotation-service-app-name> \
  --resource-group <resource-group> \
  --settings \
    EVENT_GRID_TOPIC_ENDPOINT=<event-grid-topic-endpoint> \
    EVENT_GRID_TOPIC_KEY=<event-grid-topic-key> \
    PIPELINE_SERVICE_URL=https://<pipeline-service>.azurewebsites.net \
    INTERNAL_SERVICE_KEY=<generated-key>
```

#### Policy Service
```bash
az functionapp config appsettings set \
  --name <policy-service-app-name> \
  --resource-group <resource-group> \
  --settings \
    EVENT_GRID_TOPIC_ENDPOINT=<event-grid-topic-endpoint> \
    EVENT_GRID_TOPIC_KEY=<event-grid-topic-key>
```

### 3. Seed Enhanced Pipeline Definition

Run the seed script to create the enhanced Medical LOB pipeline:

```bash
cd src/pipeline-service
npm run seed
```

Or manually via Azure Functions:

```bash
# Create a one-time HTTP trigger or use Azure Portal to run the seed function
```

### 4. Configure Event Grid Subscriptions

Follow the guide in `EVENT_GRID_CONFIGURATION.md` to set up:
- Action event subscriptions (Pipeline → Services)
- Completion event subscriptions (Services → Pipeline)
- Advanced filters (recommended)

### 5. Configure APIM Gateway (Optional)

If using APIM for sync calls:
1. Create/update APIM instance
2. Configure backend services
3. Set up policies (see `APIM_INTEGRATION.md`)
4. Set `APIM_GATEWAY_URL` in Pipeline Service

### 6. Enable Durable Functions (Optional)

If using Durable Functions for policy issuance:
1. Install Durable Functions extension in Policy Service
2. Configure storage account for orchestration state
3. Uncomment orchestrator import in `policy-service/src/index.ts`
4. Update `host.json` with Durable Functions configuration

### 7. Test Deployment

#### 7.1 Create Test Lead
```bash
curl -X POST https://<lead-service>.azurewebsites.net/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "customerId": "test-customer-id"
  }'
```

#### 7.2 Monitor Pipeline Execution
- Check Application Insights for pipeline instance creation
- Verify Event Grid events are being published/received
- Check service logs for action handler invocations
- Monitor lead stage updates

#### 7.3 Verify End-to-End Flow
1. Lead created → Pipeline instance created
2. Plans fetched → Stage updated to "Plans Available"
3. Quotation created → Stage updated to "Quotation Created"
4. Quotation sent → Stage updated to "Quotation Sent"
5. Policy issued → Stage updated to "Policy Issued"

### 8. Monitoring Setup

#### Application Insights
- Enable Application Insights for all services
- Configure custom events for pipeline actions
- Set up alerts for failures

#### Event Grid Metrics
- Monitor event delivery success rates
- Check dead letter queue for failed deliveries
- Review subscription metrics

#### Service Health Checks
- Verify all services are responding
- Check Event Grid connectivity
- Validate Cosmos DB connections

## Post-Deployment Validation

### Functional Validation
- [ ] Lead creation triggers pipeline instance
- [ ] Plans are fetched asynchronously
- [ ] Quotation creation works synchronously
- [ ] Quotation sending works asynchronously
- [ ] Policy issuance works asynchronously
- [ ] Lead stages update correctly
- [ ] Pipeline completes successfully

### Performance Validation
- [ ] Sync actions complete in <500ms
- [ ] Async actions complete within timeout windows
- [ ] No duplicate event processing
- [ ] Correlation IDs flow correctly

### Error Handling Validation
- [ ] Retry logic works for failed actions
- [ ] Fallback stages are reached on failures
- [ ] Errors are logged correctly
- [ ] Dead letter queue captures failed events

## Rollback Plan

If issues are discovered:

1. **Immediate Rollback**: Revert to previous deployment
   ```bash
   az functionapp deployment source sync \
     --name <service-app-name> \
     --resource-group <resource-group>
   ```

2. **Partial Rollback**: Disable enhanced pipeline
   - Set old pipeline as default
   - Disable new event subscriptions
   - Re-enable old event handlers

3. **Data Cleanup**: If needed, clean up test data
   - Remove test pipeline instances
   - Clean up test leads
   - Reset service state

## Troubleshooting

### Pipeline Instance Not Created
- Check `lead.created` event is published
- Verify Event Grid subscription is active
- Check Pipeline Service logs for errors
- Verify Cosmos DB connection

### Actions Not Executing
- Check Event Grid subscriptions are configured
- Verify service endpoints are correct
- Check service authentication (x-service-key)
- Review service logs for handler errors

### Completion Events Not Received
- Verify completion events are published
- Check Event Grid subscription filters
- Review Pipeline Service event handler logs
- Check correlation ID matching

### Performance Issues
- Enable APIM for rate limiting
- Review Event Grid advanced filters
- Check Cosmos DB query performance
- Monitor service response times

## Next Steps

After successful deployment:

1. Monitor for 24-48 hours
2. Collect performance metrics
3. Review error logs
4. Gather user feedback
5. Plan production deployment

## Production Deployment

For production deployment:
1. Use blue-green deployment strategy
2. Migrate in-flight pipeline instances
3. Set up comprehensive monitoring
4. Configure alerting
5. Plan rollback procedures
6. Document runbooks

