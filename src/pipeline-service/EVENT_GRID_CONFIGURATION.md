# Event Grid Configuration Guide

This document describes how to configure Azure Event Grid subscriptions for the hybrid sync/async pipeline architecture.

## Overview

The pipeline service uses Event Grid to:
- **Publish action events** to services (async operations)
- **Receive completion events** from services

## Required Subscriptions

### 1. Action Events (Pipeline → Services)

These subscriptions route action events from the Pipeline Service to the appropriate service handlers.

#### 1.1 Fetch Plans Action
- **Event Type**: `pipeline.action.fetch_plans`
- **Endpoint**: `https://quotation-gen-service.azurewebsites.net/api/handleFetchPlansAction`
- **Filter**: 
  ```json
  {
    "includedEventTypes": ["pipeline.action.fetch_plans"]
  }
  ```

#### 1.2 Send Quotation Action
- **Event Type**: `pipeline.action.send_quotation`
- **Endpoint**: `https://quotation-service.azurewebsites.net/api/handleSendQuotationAction`
- **Filter**:
  ```json
  {
    "includedEventTypes": ["pipeline.action.send_quotation"]
  }
  ```

#### 1.3 Issue Policy Action
- **Event Type**: `pipeline.action.issue_policy`
- **Endpoint**: `https://policy-service.azurewebsites.net/api/handleIssuePolicyAction`
- **Filter**:
  ```json
  {
    "includedEventTypes": ["pipeline.action.issue_policy"]
  }
  ```

### 2. Completion Events (Services → Pipeline)

This subscription routes all completion events back to the Pipeline Service.

#### 2.1 Service Completions
- **Event Types**: 
  - `service.plans.fetched`
  - `service.plans.fetch_failed`
  - `service.quotation.sent`
  - `service.quotation.send_failed`
  - `service.policy.issued`
  - `service.policy.issue_failed`
- **Endpoint**: `https://pipeline-service.azurewebsites.net/api/PipelineOrchestrator`
- **Filter**:
  ```json
  {
    "includedEventTypes": [
      "service.plans.fetched",
      "service.plans.fetch_failed",
      "service.quotation.sent",
      "service.quotation.send_failed",
      "service.policy.issued",
      "service.policy.issue_failed"
    ]
  }
  ```

## Advanced Filtering (Recommended)

To reduce fan-out noise and improve performance, add data-level filters:

### Action Events with Advanced Filters

```json
{
  "name": "action-fetch-plans-filtered",
  "filter": {
    "includedEventTypes": ["pipeline.action.fetch_plans"],
    "advancedFilters": [
      {
        "operatorType": "StringContains",
        "key": "data.instanceId",
        "values": [""]
      }
    ]
  },
  "endpoint": "https://quotation-gen-service.azurewebsites.net/api/handleFetchPlansAction"
}
```

### Completion Events with Advanced Filters

```json
{
  "name": "completion-to-pipeline-filtered",
  "filter": {
    "includedEventTypes": [
      "service.plans.fetched",
      "service.quotation.sent",
      "service.policy.issued"
    ],
    "advancedFilters": [
      {
        "operatorType": "StringContains",
        "key": "data.instanceId",
        "values": [""]
      },
      {
        "operatorType": "StringIn",
        "key": "data.status",
        "values": ["success", "failure"]
      }
    ]
  },
  "endpoint": "https://pipeline-service.azurewebsites.net/api/PipelineOrchestrator"
}
```

## Configuration via Azure Portal

1. Navigate to your Event Grid Topic
2. Go to **Event Subscriptions**
3. Click **+ Event Subscription**
4. Configure each subscription as described above
5. Enable **Dead Letter Queue** for production environments

## Configuration via Azure CLI

```bash
# Create subscription for fetch plans action
az eventgrid event-subscription create \
  --name action-fetch-plans \
  --source-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.EventGrid/topics/{topic-name} \
  --included-event-types pipeline.action.fetch_plans \
  --endpoint https://quotation-gen-service.azurewebsites.net/api/handleFetchPlansAction

# Create subscription for completion events
az eventgrid event-subscription create \
  --name completion-to-pipeline \
  --source-resource-id /subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.EventGrid/topics/{topic-name} \
  --included-event-types service.plans.fetched service.quotation.sent service.policy.issued \
  --endpoint https://pipeline-service.azurewebsites.net/api/PipelineOrchestrator
```

## Configuration via Bicep/ARM

See the infrastructure repository for Infrastructure-as-Code templates.

## Dead Letter Queue Setup

For production, configure dead letter queues for all subscriptions:

```json
{
  "deadLetterDestination": {
    "endpointType": "StorageBlob",
    "properties": {
      "blobContainerName": "eventgrid-dlq",
      "storageAccountResourceId": "/subscriptions/{sub-id}/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{storage-account}"
    }
  },
  "maxDeliveryAttempts": 30
}
```

## Testing

After configuration, test the subscriptions:

1. Create a test lead (triggers `lead.created`)
2. Monitor Event Grid metrics for event deliveries
3. Check service logs for action handler invocations
4. Verify completion events are received by Pipeline Service

## Monitoring

- **Event Grid Metrics**: Delivery success/failure rates
- **Service Logs**: Action handler execution
- **Application Insights**: End-to-end correlation tracking
- **Dead Letter Queue**: Failed event deliveries

## Troubleshooting

### Events Not Delivered
- Check subscription filters match event types
- Verify endpoint URLs are correct
- Check service authentication (x-service-key header)
- Review dead letter queue for failed deliveries

### Duplicate Events
- Verify correlation ID matching in completion handlers
- Check Event Grid deduplication settings
- Review service retry logic

### Performance Issues
- Enable advanced filtering to reduce fan-out
- Review subscription count (too many can cause delays)
- Check endpoint response times

