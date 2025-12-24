# Pipeline Instance Diagnostic Check

## How to Check Pipeline Instance Status

After creating a lead, you can check the pipeline instance status using this API endpoint:

### Endpoint
```
GET /api/pipeline/check/{leadId}
```

### Example
```bash
# Replace {leadId} with your actual lead ID
curl https://your-pipeline-service.azurewebsites.net/api/pipeline/check/{leadId}
```

### Response Format

The response includes:
1. **Instance Details** - All the instance information
2. **Diagnostics** - Automatic checks to identify issues

### Example Response

```json
{
  "leadId": "your-lead-id",
  "hasActivePipeline": true,
  "instance": {
    "instanceId": "...",
    "pipelineName": "...",
    "status": "active",
    "currentStepId": "...",
    "currentStepType": "stage",
    "currentStageName": "Lead Created",
    "currentStageId": "lead-created",
    "progressPercent": 10,
    "completedStepsCount": 1,
    "totalStepsCount": 10,
    "waitingForEvent": "plans.fetch_started",
    "nextStepId": "...",
    "nextStepType": "stage",
    "nextStageName": "Plans Fetching"
  },
  "diagnostics": {
    "message": "Pipeline instance found",
    "checks": {
      "progressIsZero": {
        "status": "OK",
        "value": 10,
        "expected": "> 0%",
        "description": "Progress is 10% (correct)"
      },
      "stageNotSet": {
        "status": "OK",
        "value": "Lead Created",
        "expected": "Stage name should be set",
        "description": "Current stage: Lead Created"
      },
      "notWaitingForEvent": {
        "status": "OK",
        "value": "plans.fetch_started",
        "expected": "Should be waiting for next stage trigger event",
        "description": "Waiting for: plans.fetch_started"
      },
      "completedStepsCount": {
        "status": "OK",
        "value": 1,
        "expected": ">= 1",
        "description": "Completed 1 of 10 steps"
      }
    },
    "summary": {
      "allChecksPass": true,
      "issues": []
    }
  }
}
```

### What to Look For

#### ✅ **All Good** - If you see:
- `progressIsZero.status: "OK"` and `value > 0`
- `stageNotSet.status: "OK"` and stage name is set
- `notWaitingForEvent.status: "OK"` and waiting event is set
- `completedStepsCount.status: "OK"` and value >= 1
- `summary.allChecksPass: true`

#### ❌ **Issues Found** - If you see:
- `progressIsZero.status: "ISSUE"` - Progress is 0%
  - **Fix**: This means the instance was created before the fix was deployed, or there was an error during creation
  - **Action**: Create a new lead to test with the fixed code

- `stageNotSet.status: "ISSUE"` - Stage name not set
  - **Fix**: The entry step execution may have failed
  - **Action**: Check if Lead Service is accessible and INTERNAL_SERVICE_KEY is configured

- `notWaitingForEvent.status: "WARNING"` - Not waiting for event
  - **Fix**: The instance may not be set up to receive the next event
  - **Action**: Check if the next step is a stage step

- `completedStepsCount.status: "ISSUE"` - Completed steps is 0
  - **Fix**: Same as progress issue - instance created before fix
  - **Action**: Create a new lead

### Quick Test Script

```bash
#!/bin/bash
# Replace with your actual values
LEAD_ID="your-lead-id-here"
PIPELINE_SERVICE_URL="https://your-pipeline-service.azurewebsites.net"

echo "Checking pipeline instance for lead: $LEAD_ID"
echo ""

curl -s "$PIPELINE_SERVICE_URL/api/pipeline/check/$LEAD_ID" | jq '{
  hasActivePipeline: .hasActivePipeline,
  currentStage: .instance.currentStageName,
  progress: .instance.progressPercent,
  waitingFor: .instance.waitingForEvent,
  diagnostics: .diagnostics.summary
}'
```

### Using in Browser

You can also check directly in your browser:
```
https://your-pipeline-service.azurewebsites.net/api/pipeline/check/{leadId}
```

The response will show you all the diagnostic information without needing Azure logs!








