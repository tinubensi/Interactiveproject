# Duplicate Timeline Entries - Root Cause Analysis

## Issue
Multiple timeline entries are being created for the same stage update (e.g., 5 "Plans Available" entries at the same timestamp).

## Root Cause

### Primary Issue: Missing Idempotency Check in `updateStageInternal`

**Location**: `nectaria-services/src/lead-service/src/functions/leads/updateStageInternal.ts`

**Problem**: The function does NOT check if the lead is already at the requested stage before:
1. Updating the lead in Cosmos DB
2. Creating a timeline entry (line 93)
3. Publishing a `lead.stage_changed` event (line 106)

**Code Flow**:
```typescript
// Line 53: Get existing lead
const existingLead = await cosmosService.getLeadById(id, lineOfBusiness);

// Line 76-79: Update lead (no check if already at this stage)
updatedLead = await cosmosService.updateLead(id, lineOfBusiness, {
  currentStage: body.stageName,
  stageId: body.stageId
});

// Line 93: ALWAYS creates timeline entry, even if stage didn't change
await cosmosService.createTimelineEntry({
  stage: body.stageName,
  previousStage: existingLead.currentStage, // This might be the same!
  // ...
});
```

### Secondary Issues Contributing to Duplicate Calls

1. **Retry Logic Without Idempotency** (`orchestrator.ts` lines 751-815):
   - `executeStageStep` retries up to 3 times if `updateLeadStage` returns `false`
   - If the HTTP call succeeds on the server but times out on the client, it will retry
   - Each retry creates a new timeline entry

2. **No Timeout on HTTP Calls** (`leadServiceClient.ts` line 100):
   - `updateLeadStage` uses `fetch()` without a timeout
   - Slow responses might cause the client to think the call failed and retry

3. **Potential Duplicate Event Processing**:
   - Event Grid might deliver the same event multiple times
   - If the same event is processed multiple times, `executeStep` will be called multiple times
   - Each call to `executeStep` → `executeStageStep` → `updateLeadStage` creates a timeline entry

4. **Verification Logic** (`orchestrator.ts` lines 766-791):
   - After updating the lead stage, the code verifies the update by calling `getLead` up to 3 times
   - This doesn't create timeline entries, but if verification fails, it might trigger additional retries

## Evidence from Code

### In `updateStageInternal.ts`:
- **Line 53**: Gets existing lead
- **Line 76-79**: Updates lead without checking if `existingLead.currentStage === body.stageName`
- **Line 93**: Always creates timeline entry, even if stage is unchanged
- **Line 97**: Uses `existingLead.currentStage` as `previousStage`, which might be the same as `body.stageName`

### In `orchestrator.ts`:
- **Line 751-815**: Retry loop that calls `updateLeadStage` up to 3 times
- **Line 754**: Each retry calls `updateLeadStage`, which calls `updateStageInternal`
- **Line 761**: Only breaks if `success === true`, but if response is slow, might retry even if first call succeeded

### In `leadServiceClient.ts`:
- **Line 100**: `fetch()` call has no timeout
- **Line 112-115**: Returns `false` on any error, triggering retries
- **Line 119-121**: Returns `false` on exceptions, triggering retries

## Scenarios That Cause Duplicates

1. **HTTP Timeout Scenario**:
   - Pipeline Service calls `updateLeadStage`
   - Lead Service receives request and updates lead (creates timeline entry #1)
   - Response is slow/times out
   - Pipeline Service retries (creates timeline entry #2)
   - Process repeats (timeline entries #3, #4, #5)

2. **Duplicate Event Processing**:
   - Event Grid delivers `plans.fetch_completed` event
   - Pipeline Service processes it → calls `updateLeadStage` (timeline entry #1)
   - Event Grid delivers the same event again (retry or duplicate)
   - Pipeline Service processes it again → calls `updateLeadStage` (timeline entry #2)

3. **Same Stage Update**:
   - Lead is already at "Plans Available"
   - Pipeline Service calls `updateLeadStage` with "Plans Available"
   - `updateStageInternal` doesn't check, creates timeline entry anyway

## Recommended Fixes

### Fix 1: Add Idempotency Check (CRITICAL)
In `updateStageInternal.ts`, check if the lead is already at the requested stage:

```typescript
// After line 66, before line 68
// Check if lead is already at this stage
if (existingLead.currentStage === body.stageName && existingLead.stageId === body.stageId) {
  context.log(`Lead ${id} is already at stage ${body.stageName} - skipping update`);
  return {
    status: 200,
    jsonBody: {
      success: true,
      message: 'Lead already at requested stage',
      data: {
        lead: existingLead,
        stageChange: {
          from: existingLead.currentStage,
          to: body.stageName,
          skipped: true
        }
      }
    }
  };
}
```

### Fix 2: Add Timeout to HTTP Calls
In `leadServiceClient.ts`, add a timeout to the fetch call:

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

try {
  const response = await fetch(url, {
    // ... existing options
    signal: controller.signal
  });
  clearTimeout(timeoutId);
  // ... rest of the code
} catch (error) {
  clearTimeout(timeoutId);
  // ... error handling
}
```

### Fix 3: Add Request Deduplication
Consider adding request deduplication using request IDs or checking recent timeline entries before creating new ones.

### Fix 4: Improve Retry Logic
Only retry on actual failures (5xx errors), not on timeouts if the request might have succeeded.

## Impact

- **User Experience**: Timeline shows duplicate entries, making it confusing to track actual stage changes
- **Data Quality**: Unnecessary timeline entries clutter the database
- **Performance**: Extra database writes and event publications
- **Debugging**: Harder to identify actual stage progression vs. duplicate updates

## Priority

**HIGH** - This affects data quality and user experience. The idempotency check (Fix 1) should be implemented immediately.

