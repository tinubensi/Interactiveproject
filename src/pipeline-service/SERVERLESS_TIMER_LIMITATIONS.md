# Serverless Timer Limitations and Solutions

## ⚠️ Critical Issue: setTimeout in Azure Functions

The current implementation uses `setTimeout` for delayed operations (auto-advance, retries). This pattern has serious limitations in serverless environments:

### Problems with setTimeout in Azure Functions

1. **Function Termination**: Azure Functions may terminate after the main execution completes, killing any pending setTimeout callbacks
2. **Data Loss**: Scheduled operations (auto-advance, retries) may never execute, leading to stuck pipeline instances
3. **No Guarantees**: There's no guarantee the callback will fire before the function instance is recycled
4. **Scale-Down**: When Azure scales down, function instances are terminated, abandoning scheduled timers

### Current Mitigations (Development Only)

The code includes several safety checks to minimize issues:

1. **State Validation**: Before executing delayed operations, validates that:
   - Instance still exists
   - Instance hasn't transitioned to a different step
   - Instance isn't in a terminal state (completed/failed/cancelled)
   - Instance isn't waiting for other actions/events

2. **Comprehensive Logging**: All timer operations log warnings about serverless limitations

3. **Error Handling**: Wrapped in try-catch with fallback error recording

**These mitigations reduce but DO NOT eliminate the core problem.**

## ✅ Production-Ready Solutions

### Option 1: Azure Durable Functions (Recommended)

**Best for**: Complex orchestrations with multiple delays, retries, and state management.

```typescript
import * as df from 'durable-functions';

// Orchestrator function
const pipelineOrchestrator = df.orchestrator(function* (context) {
  const instance = context.df.getInput();
  
  try {
    // Execute sync action
    yield context.df.callActivity('executeSyncAction', { instance, config });
    
    // Auto-advance with delay
    if (config.autoAdvance?.enabled && config.autoAdvance.delayMs > 0) {
      const deadline = context.df.currentUtcDateTime;
      deadline.setMilliseconds(deadline.getMilliseconds() + config.autoAdvance.delayMs);
      yield context.df.createTimer(deadline);
      
      // Validate state and advance
      const refreshedInstance = yield context.df.callActivity('getInstance', instance.instanceId);
      if (shouldAutoAdvance(refreshedInstance)) {
        yield context.df.callActivity('advanceToStep', { instance: refreshedInstance, nextStep });
      }
    }
  } catch (error) {
    // Retry with exponential backoff
    yield context.df.callActivity('handleActionFailure', { instance, error });
  }
});
```

**Benefits**:
- Built-in durable timers that survive function termination
- Automatic state persistence
- Built-in retry policies with exponential backoff
- Checkpointing and replay
- Perfect for complex sagas

**Setup**:
```bash
cd nectaria-services/src/pipeline-service
npm install durable-functions
```

**Configuration** (`host.json`):
```json
{
  "extensions": {
    "durableTask": {
      "hubName": "PipelineOrchestration",
      "storageProvider": {
        "connectionStringName": "AzureWebJobsStorage"
      },
      "maxConcurrentActivityFunctions": 10,
      "maxConcurrentOrchestratorFunctions": 5
    }
  }
}
```

### Option 2: Azure Storage Queue with Visibility Timeout

**Best for**: Simple delayed operations, lower cost than Durable Functions.

```typescript
import { QueueServiceClient } from '@azure/storage-queue';

async function scheduleDelayedRetry(
  instance: PipelineInstance,
  step: PipelineStep,
  config: SyncActionConfig,
  delayMs: number
): Promise<void> {
  const queueClient = QueueServiceClient
    .fromConnectionString(process.env.AZURE_STORAGE_CONNECTION_STRING!)
    .getQueueClient('pipeline-retries');
  
  await queueClient.createIfNotExists();
  
  const message = {
    instanceId: instance.instanceId,
    stepId: step.id,
    action: 'sync_retry',
    config,
    timestamp: new Date().toISOString(),
  };
  
  // visibilityTimeout controls when the message becomes visible (delayed execution)
  await queueClient.sendMessage(
    Buffer.from(JSON.stringify(message)).toString('base64'),
    {
      visibilityTimeout: Math.ceil(delayMs / 1000), // Convert ms to seconds
    }
  );
  
  log(`[RETRY] Scheduled retry via Storage Queue with ${delayMs}ms delay`);
}

// Handler function triggered by Storage Queue
export async function handlePipelineRetryQueue(
  message: QueueMessage,
  context: InvocationContext
): Promise<void> {
  const payload = JSON.parse(Buffer.from(message.messageText, 'base64').toString());
  
  const instance = await getInstance(payload.instanceId);
  if (!instance || ['completed', 'cancelled', 'failed'].includes(instance.status)) {
    context.log('Retry skipped: instance no longer active');
    return;
  }
  
  // Execute the retry
  await executeSyncAction(instance, pipeline, step, payload.config, context.log);
}
```

**Function binding** (`function.json`):
```json
{
  "bindings": [
    {
      "name": "message",
      "type": "queueTrigger",
      "direction": "in",
      "queueName": "pipeline-retries",
      "connection": "AzureWebJobsStorage"
    }
  ]
}
```

**Benefits**:
- Persistent, durable delayed execution
- Automatic retries (with poison queue)
- Scales automatically
- Lower cost than Durable Functions
- Simple to implement

**Limitations**:
- Maximum delay: 7 days
- No orchestration features (use Durable Functions for complex workflows)

### Option 3: Azure Service Bus Scheduled Messages

**Best for**: High-volume, enterprise scenarios with advanced messaging features.

```typescript
import { ServiceBusClient } from '@azure/service-bus';

async function scheduleAutoAdvance(
  instance: PipelineInstance,
  step: PipelineStep,
  nextStep: PipelineStep,
  delayMs: number
): Promise<void> {
  const sbClient = new ServiceBusClient(process.env.SERVICE_BUS_CONNECTION_STRING!);
  const sender = sbClient.createSender('pipeline-auto-advance');
  
  const scheduledTime = new Date(Date.now() + delayMs);
  
  await sender.scheduleMessages(
    {
      body: {
        instanceId: instance.instanceId,
        fromStepId: step.id,
        toStepId: nextStep.id,
        timestamp: new Date().toISOString(),
      },
      applicationProperties: {
        action: 'auto_advance',
        pipelineId: instance.pipelineId,
      },
    },
    scheduledTime
  );
  
  await sender.close();
  await sbClient.close();
  
  log(`[AUTO-ADVANCE] Scheduled via Service Bus for ${scheduledTime.toISOString()}`);
}
```

**Benefits**:
- Advanced message features (dead-letter queue, duplicate detection, sessions)
- Scheduled messages up to year in advance
- FIFO ordering guarantees (with sessions)
- Built-in duplicate detection

**Limitations**:
- Higher cost than Storage Queue
- More complex setup

## Migration Plan

### Phase 1: Add Queue-Based Retries (Immediate)

1. Create Azure Storage Queue: `pipeline-retries`
2. Update `executeSyncAction` and `executeAsyncAction` to use queue-based retries
3. Add queue-triggered function handler
4. Test retry behavior

### Phase 2: Implement Durable Functions for Auto-Advance (Week 2)

1. Install `durable-functions` package
2. Create orchestrator function for pipeline execution
3. Replace setTimeout-based auto-advance with durable timers
4. Migrate existing pipelines incrementally
5. Monitor and validate

### Phase 3: Full Durable Functions Migration (Week 3-4)

1. Convert entire pipeline execution to Durable Functions orchestration
2. Implement sub-orchestrations for complex steps
3. Add monitoring dashboards
4. Performance testing and optimization

## Immediate Action Items

1. **Development**: Current setTimeout-based approach is acceptable with mitigations
2. **Staging**: Implement Option 2 (Storage Queue) for retries
3. **Production**: Use Option 1 (Durable Functions) for complete reliability

## Testing Recommendations

### Simulate Function Termination
```bash
# Force terminate function mid-execution
az functionapp stop --name your-function-app --resource-group your-rg
```

### Monitor Stuck Instances
```sql
-- Cosmos DB query to find instances stuck waiting for actions
SELECT * FROM c 
WHERE c.waitingForAction != null 
  AND c.actionStartedAt < "2024-01-01T00:00:00Z" 
  AND c.status = 'active'
```

## References

- [Azure Durable Functions](https://learn.microsoft.com/en-us/azure/azure-functions/durable/durable-functions-overview)
- [Azure Storage Queues](https://learn.microsoft.com/en-us/azure/storage/queues/storage-queues-introduction)
- [Azure Service Bus Scheduled Messages](https://learn.microsoft.com/en-us/azure/service-bus-messaging/message-sequencing)

## Summary

**Current State**: setTimeout-based delays with safety checks (development only)
**Recommended**: Azure Durable Functions for production reliability
**Quick Win**: Azure Storage Queue for retries (intermediate solution)

The current implementation will work for development and testing but **MUST NOT be deployed to production** without replacing setTimeout with one of the durable solutions above.

