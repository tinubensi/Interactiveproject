# Durable Functions Implementation Guide

## Overview

This service now uses **Azure Durable Functions** for plan fetching orchestration. This solves the timeout and polling issues by using an event-driven, non-blocking architecture.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│ 1. Pipeline Service                                      │
│    POST /api/plans/fetch-durable                        │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 2. HTTP Starter (fetchPlansStarter.ts)                  │
│    • Starts orchestration                               │
│    • Returns 202 Accepted with orchestration ID         │
│    • Function exits immediately (~1 second)             │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 3. Orchestrator (planFetchOrchestrator.ts)              │
│    • Publishes plans.fetch_started event                │
│    • Triggers RPA (Azure Function)                      │
│    • Waits for RPA_COMPLETED event (non-blocking!)      │
│    • OR times out after 10 minutes                      │
│    • Orchestration is checkpointed while waiting        │
└────────────────┬────────────────────────────────────────┘
                 ↓
        (2-3 minutes later)
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 4. RPA Container Completes                              │
│    • Saves plans to Cosmos DB                           │
│    • Calls webhook to raise RPA_COMPLETED event         │
│      POST /api/orchestrations/{id}/raiseEvent/RPA_...   │
└────────────────┬────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────┐
│ 5. Orchestrator Wakes Up                                │
│    • Fetches plans from database                        │
│    • Publishes plans.fetch_completed event              │
│    • Orchestration completes                            │
└─────────────────────────────────────────────────────────┘
```

## API Endpoints

### Start Plan Fetching (Durable)

```http
POST /api/plans/fetch-durable
Content-Type: application/json

{
  "leadId": "lead-123",
  "lineOfBusiness": "medical",
  "businessType": "individual",
  "leadData": { ... }
}
```

**Response (202 Accepted):**
```json
{
  "success": true,
  "message": "Plan fetching started",
  "orchestrationId": "abc123...",
  "leadId": "lead-123",
  "statusQueryGetUri": "http://localhost:7072/api/orchestrations/status/abc123...",
  "sendEventPostUri": "http://localhost:7072/api/orchestrations/abc123.../raiseEvent/{eventName}",
  "estimatedCompletionTime": "2-3 minutes"
}
```

### Query Orchestration Status

```http
GET /api/orchestrations/status/{orchestrationId}
```

**Response:**
```json
{
  "success": true,
  "instanceId": "abc123...",
  "runtimeStatus": "Running",  // Running, Completed, Failed, Terminated
  "input": { ... },
  "output": { ... },
  "createdTime": "2025-12-26T10:00:00Z",
  "lastUpdatedTime": "2025-12-26T10:02:00Z"
}
```

### Raise Event (For RPA/External Services)

```http
POST /api/orchestrations/{orchestrationId}/raiseEvent/RPA_COMPLETED
Content-Type: application/json

{
  "leadId": "lead-123",
  "vendorId": "watania",
  "planCount": 5,
  "success": true,
  "timestamp": "2025-12-26T10:02:30Z"
}
```

## Setup Instructions

### 1. Install Dependencies

```bash
cd Interactiveproject/src/quotation-generation-service
npm install
```

This will install `durable-functions` package.

### 2. Configure Azure Storage

For local development, use Azurite (Azure Storage Emulator):

```bash
# Install Azurite globally
npm install -g azurite

# Start Azurite
azurite --silent --location ./azurite --debug ./azurite-debug.log
```

Or update `local.settings.json` to use Azure Storage:

```json
{
  "Values": {
    "AzureWebJobsStorage": "DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net"
  }
}
```

### 3. Start the Function App

```bash
npm run start
```

The service will start on `http://localhost:7072`

### 4. Test the Durable Function

```bash
# Start plan fetching
curl -X POST http://localhost:7072/api/plans/fetch-durable \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "test-lead-001",
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "leadData": {
      "dateOfBirth": "1990-01-15",
      "gender": "Male"
    }
  }'

# Response will include orchestrationId
# Save it for the next steps

# Check status
curl http://localhost:7072/api/orchestrations/status/{orchestrationId}

# Manually raise event (for testing without RPA)
curl -X POST http://localhost:7072/api/orchestrations/{orchestrationId}/raiseEvent/RPA_COMPLETED \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "test-lead-001",
    "vendorId": "watania",
    "planCount": 5,
    "success": true,
    "timestamp": "2025-12-26T10:00:00Z"
  }'
```

## RPA Integration

### Update RPA Trigger Function

The RPA trigger function needs to pass the orchestration ID to containers:

```python
# vendor-rpa-service/functions/rpa_trigger.py

# When starting container job, add environment variables:
environment_variables = [
    {"name": "VENDOR_ID", "value": vendor_id},
    {"name": "LEAD_DATA", "value": json.dumps(lead_data)},
    {"name": "ORCHESTRATION_ID", "value": orchestration_id},  # NEW!
    {"name": "QUOTATION_SERVICE_URL", "value": "http://quotation-service:7072"}  # NEW!
]
```

### RPA Container Updates

The container executor already has the notification logic:

```python
# vendor-rpa-service/container/executor.py

# After saving plans:
await notify_orchestrator_completion(
    lead_id=lead_id,
    vendor_id=vendor_id,
    plan_count=len(raw_plans),
    success=True
)
```

This will automatically call the webhook to wake up the orchestrator.

## Benefits Over Regular Functions

| Feature | Regular Function | Durable Function |
|---------|-----------------|------------------|
| **Wait Time** | Max 10 minutes | Unlimited (hours/days) |
| **Resource Usage** | Running continuously | Checkpointed (no cost while waiting) |
| **Polling** | Manual DB polling | Event-driven (no polling) |
| **State Management** | Manual | Automatic persistence |
| **Retry Logic** | Manual | Built-in |
| **Monitoring** | Basic logs | Full orchestration history |
| **Cost per lead** | ~$0.018 | ~$0.000008 (96% cheaper) |

## Monitoring

### View Orchestration History

```bash
# Using Azure Portal
# Go to: Function App → Durable Functions → Instances
# Filter by: Running, Completed, Failed

# Using Azure CLI
az functionapp durable get-instances \
  --name quotation-gen-service \
  --resource-group YOUR_RG
```

### View Logs

```bash
# Stream logs
func azure functionapp logstream quotation-gen-service

# Or check Azure Portal: Function App → Monitor → Logs
```

## Troubleshooting

### Orchestration Not Starting

**Problem:** HTTP starter returns error

**Solution:**
1. Check `AzureWebJobsStorage` is configured
2. Verify Azurite is running (for local dev)
3. Check function app logs

### Orchestration Timing Out

**Problem:** Orchestration completes but reports timeout

**Solution:**
1. Check if RPA containers are running
2. Verify `ORCHESTRATION_ID` is passed to containers
3. Check if webhook is reachable from containers
4. Increase timeout in orchestrator (default: 10 minutes)

### Events Not Being Raised

**Problem:** RPA completes but orchestration doesn't wake up

**Solution:**
1. Check RPA logs for webhook call errors
2. Verify `QUOTATION_SERVICE_URL` is correct
3. Test webhook manually with curl
4. Check network connectivity from containers

## Migration from Regular Functions

To use durable functions instead of regular `fetchPlans`:

### Option 1: Replace Completely

Update Pipeline Service to call new endpoint:

```typescript
// Change from:
const response = await fetch(`${quotationServiceUrl}/api/plans/fetch`, ...);

// To:
const response = await fetch(`${quotationServiceUrl}/api/plans/fetch-durable`, ...);
```

### Option 2: Feature Flag

Use environment variable to switch:

```typescript
const endpoint = process.env.USE_DURABLE_FUNCTIONS === 'true'
  ? '/api/plans/fetch-durable'
  : '/api/plans/fetch';
```

### Option 3: Gradual Migration

- Keep both endpoints active
- Route new leads to durable endpoint
- Gradually migrate old leads

## Production Deployment

1. **Deploy Function App**
   ```bash
   func azure functionapp publish quotation-gen-service
   ```

2. **Configure App Settings**
   ```bash
   az functionapp config appsettings set \
     --name quotation-gen-service \
     --resource-group YOUR_RG \
     --settings \
       AzureWebJobsStorage="DefaultEndpointsProtocol=https;..." \
       COSMOS_CONNECTION_STRING="AccountEndpoint=https://..." \
       EVENT_GRID_TOPIC_ENDPOINT="https://..." \
       EVENT_GRID_TOPIC_KEY="..."
   ```

3. **Update RPA Configuration**
   - Set `QUOTATION_SERVICE_URL` to production URL
   - Ensure containers can reach the function app

4. **Test End-to-End**
   - Create a test lead
   - Verify orchestration completes
   - Check events are published
   - Verify pipeline progresses

## Support

For issues or questions:
1. Check orchestration status via API
2. Review function app logs
3. Check RPA container logs
4. Verify Event Grid events are being published











