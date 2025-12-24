# Complete Pipeline Workflow - Verified Flow

## Expected Flow After Deployment

### Step 1: Lead Created
1. Lead is created via Lead Service
2. `lead.created` event is published to Event Grid
3. Pipeline Service receives event:
   - Creates pipeline instance
   - Sets current stage: "Lead Created" (stage-0)
   - Sets progress: 10% (1/10 steps)
   - Executes entry step → Updates lead to "Lead Created" stage
   - Sets `waitingForEvent: "plans.fetch_started"`
   - Triggers plan fetching via HTTP call to quotation-generation-service

**Result**: 
- Pipeline instance: `currentStageName: "Lead Created"`, `progressPercent: 10%`, `waitingForEvent: "plans.fetch_started"`
- Lead Service: `currentStage: "Lead Created"`, `stageId: "stage-0"`

### Step 2: Plans Fetching Started
1. Quotation-generation-service starts fetching plans
2. `plans.fetch_started` event is published to Event Grid
3. Pipeline Service receives event:
   - Event matches `waitingForEvent: "plans.fetch_started"` ✓
   - Advances to "Plans Fetching" stage
   - Updates progress: 20% (2/10 steps)
   - Executes "Plans Fetching" step → Updates lead to "Plans Fetching" stage
   - Sets `waitingForEvent: "plans.fetch_completed"`

**Result**:
- Pipeline instance: `currentStageName: "Plans Fetching"`, `progressPercent: 20%`, `waitingForEvent: "plans.fetch_completed"`
- Lead Service: `currentStage: "Plans Fetching"`, `stageId: "stage-1"`

### Step 3: Plans Fetching Completed
1. Quotation-generation-service completes fetching plans
2. `plans.fetch_completed` event is published to Event Grid
3. Pipeline Service receives event:
   - Event matches `waitingForEvent: "plans.fetch_completed"` ✓
   - Advances to "Plans Available" stage
   - Updates progress: 30% (3/10 steps)
   - Executes "Plans Available" step → Updates lead to "Plans Available" stage
   - Sets `waitingForEvent: "quotation.created"` (or next stage trigger)

**Result**:
- Pipeline instance: `currentStageName: "Plans Available"`, `progressPercent: 30%`, `waitingForEvent: "quotation.created"`
- Lead Service: `currentStage: "Plans Available"`, `stageId: "stage-2"`

## Event Flow Diagram

```
Lead Created
    ↓ (lead.created event)
Pipeline Instance Created
    ↓ (triggers plan fetching)
plans.fetch_started event
    ↓ (event matches waitingForEvent)
Plans Fetching Stage
    ↓ (plans.fetch_completed event)
Plans Available Stage
    ↓ (quotation.created event)
Quotation Created Stage
```

## Verification Points

After each step, verify:

1. **Pipeline Instance** (via `/api/pipeline/check/{leadId}`):
   - `currentStageName` matches expected stage
   - `progressPercent` is correct
   - `waitingForEvent` is set for next event
   - `completedStepsCount` increments correctly

2. **Lead Service** (via Lead Service API):
   - `currentStage` matches pipeline instance stage
   - `stageId` matches expected stage ID

## Key Fixes Applied

1. ✅ Progress starts at 10% (not 0%)
2. ✅ Event matching checks `waitingForEvent` first
3. ✅ Stage execution updates lead stage in Lead Service
4. ✅ Stage execution sets `waitingForEvent` for next stage
5. ✅ Enhanced logging for debugging
6. ✅ Diagnostic endpoint for checking instance state

## Testing

1. Create a lead
2. Check pipeline instance: `GET /api/pipeline/check/{leadId}`
3. Verify stage progression happens automatically
4. Check lead stage updates in Lead Service








