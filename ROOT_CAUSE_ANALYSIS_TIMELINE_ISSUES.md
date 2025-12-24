# Root Cause Analysis: Timeline Duplication and Order Issues

## Issues Identified

1. **Duplicate Timeline Entries**: Multiple timeline entries are created for the same stage update (e.g., 3+ "Plans Available" entries)
2. **Incorrect Timeline Order**: "Lead Created" should be the first timeline entry, but it appears after "Plans Available" entries
3. **Initial Stage Issue**: Lead is created with "Plans Fetching" stage instead of starting at "Lead Created"

## Root Causes

### Issue 1: Duplicate Timeline Entries

#### Root Cause 1.1: Events Processed Multiple Times (PRIMARY)

**Location**: `nectaria-services/src/pipeline-service/src/functions/events/pipelineOrchestrator.ts`

**Problem**: The same event is being processed BOTH via HTTP fallback AND Event Grid, causing duplicate processing:

1. **HTTP Fallback Processing**: Services call `/api/pipeline/process-event` directly (no event ID)
2. **Event Grid Processing**: Event Grid also delivers the same event (with event ID)
3. **Deduplication Gap**: The deduplication logic (lines 99-105) only works for Event Grid events (by event ID). HTTP fallback calls don't have event IDs, so they bypass deduplication.

**Evidence from Logs**:
```
2025-12-10T10:19:11.4149377Z | [HTTP FALLBACK] Manual event processing: lead.created
2025-12-10T10:19:11.4640083Z | Event ID: 54ac6c45-765c-410c-8c51-c3251db725d5 (Event Grid)
2025-12-10T10:19:15.8842477Z | [HTTP FALLBACK] Manual event processing: plans.fetch_started
2025-12-10T10:19:15.9029522Z | Event ID: 49591231-e84f-4421-9391-2686da9f545a (Event Grid)
2025-12-10T10:19:15.927159Z | Event ID: 72477b97-6155-4347-879c-dbc1e3e393d7 (Event Grid - duplicate!)
```

**Multiple Event Grid Deliveries**: Event Grid is delivering the same event multiple times with different event IDs (e.g., `49591231-...` and `72477b97-...` for the same `plans.fetch_started` event).

**Impact**: Each processing creates a timeline entry, resulting in duplicates.

#### Root Cause 1.2: Race Condition in Idempotency Check

**Location**: `nectaria-services/src/lead-service/src/functions/leads/updateStageInternal.ts` (lines 68-87)

**Problem**: The idempotency check has a race condition:
1. Multiple requests check `existingLead.currentStage === body.stageName` simultaneously
2. All pass the check (lead is not yet updated)
3. All proceed to update the lead and create timeline entries
4. Result: Multiple timeline entries for the same stage update

**Evidence**: Logs show multiple `[EXECUTE STAGE]` calls for the same stage within milliseconds:
```
2025-12-10T10:19:16.5581566Z | [EXECUTE STAGE] Updating lead to stage: Plans Fetching
2025-12-10T10:19:16.6877951Z | [EXECUTE STAGE] Updating lead to stage: Plans Fetching
2025-12-10T10:19:16.6886894Z | [EXECUTE STAGE] Updating lead to stage: Plans Fetching
2025-12-10T10:19:16.6888748Z | [EXECUTE STAGE] Updating lead to stage: Plans Fetching
2025-12-10T10:19:16.7249179Z | [EXECUTE STAGE] Updating lead to stage: Plans Fetching
2025-12-10T10:19:16.7435934Z | [EXECUTE STAGE] Updating lead to stage: Plans Fetching
```

#### Root Cause 1.3: Timeline Deduplication Check Not Effective

**Location**: `nectaria-services/src/lead-service/src/functions/leads/updateStageInternal.ts` (lines 89-127)

**Problem**: The timeline deduplication check (5-minute window) has issues:
1. **Race Condition**: Multiple requests can check and pass the deduplication check simultaneously
2. **Query Timing**: The query might not return the most recent entry if it was just created
3. **Cosmos DB Consistency**: Eventual consistency might cause the query to miss recent entries

### Issue 2: Incorrect Timeline Order

#### Root Cause 2.1: Lead Created with Wrong Initial Stage

**Location**: `nectaria-services/src/lead-service/src/functions/leads/createLead.ts` (lines 114-138)

**Problem**: 
1. Lead is created with `currentStage: 'Plans Fetching'` (line 114)
2. Initial timeline entry is created for "Plans Fetching" (line 132)
3. Pipeline service then updates lead to "Lead Created" (creates timeline entry)
4. Pipeline service then updates lead to "Plans Fetching" (creates timeline entry)
5. Pipeline service then updates lead to "Plans Available" (creates timeline entry)

**Result**: Timeline order is:
- Plans Fetching (from createLead)
- Lead Created (from pipeline)
- Plans Fetching (from pipeline)
- Plans Available (from pipeline)

**Expected**: Timeline should be:
- Lead Created (first)
- Plans Fetching (second)
- Plans Available (third)

### Issue 3: Initial Stage Should Be "Lead Created"

#### Root Cause 3.1: Lead Service Creates Lead with "Plans Fetching"

**Location**: `nectaria-services/src/lead-service/src/functions/leads/createLead.ts` (line 114)

**Problem**: Lead is created with `currentStage: 'Plans Fetching'` instead of `'Lead Created'`.

**Expected Behavior**:
1. Lead should be created with `currentStage: 'Lead Created'`
2. Initial timeline entry should be for "Lead Created"
3. Pipeline service should then advance to "Plans Fetching" when `plans.fetch_started` event arrives

## Solutions

### Solution 1: Fix Duplicate Event Processing

**Priority**: CRITICAL

**Approach**: 
1. **Add Request ID to HTTP Fallback**: Generate a unique request ID for HTTP fallback calls and use it for deduplication
2. **Improve Event Grid Deduplication**: Use a combination of event type + leadId + timestamp for deduplication, not just event ID
3. **Add Distributed Lock**: Use Cosmos DB optimistic concurrency or a distributed lock to prevent race conditions

**Files to Modify**:
- `nectaria-services/src/pipeline-service/src/functions/events/pipelineOrchestrator.ts`
- `nectaria-services/src/quotation-service/src/utils/pipelineFallback.ts`

### Solution 2: Fix Race Condition in Idempotency Check

**Priority**: HIGH

**Approach**: 
1. **Use Optimistic Concurrency**: Check `_etag` in Cosmos DB before updating
2. **Add Distributed Lock**: Use a lock mechanism (e.g., Cosmos DB lease) to prevent concurrent updates
3. **Atomic Update with Condition**: Use Cosmos DB conditional update: only update if `currentStage !== body.stageName`

**Files to Modify**:
- `nectaria-services/src/lead-service/src/functions/leads/updateStageInternal.ts`
- `nectaria-services/src/lead-service/src/services/cosmosService.ts`

### Solution 3: Fix Initial Stage and Timeline Order

**Priority**: HIGH

**Approach**:
1. **Change Initial Stage**: Update `createLead.ts` to create lead with `currentStage: 'Lead Created'` and `stageId: 'stage-0'`
2. **Fix Initial Timeline Entry**: Create timeline entry for "Lead Created" instead of "Plans Fetching"
3. **Remove Duplicate Timeline Entry**: Pipeline service should NOT create a timeline entry when updating from "Plans Fetching" to "Lead Created" (this is a correction, not a progression)

**Files to Modify**:
- `nectaria-services/src/lead-service/src/functions/leads/createLead.ts`
- `nectaria-services/src/pipeline-service/src/lib/orchestrator.ts` (in `executeStageStep`)

### Solution 4: Improve Timeline Deduplication

**Priority**: MEDIUM

**Approach**:
1. **Use Cosmos DB Transaction**: Wrap the check and create in a transaction
2. **Add Unique Constraint**: Use a combination of `leadId + stage + timestamp` as a unique constraint
3. **Check Before Create**: Query for existing entry with same `leadId`, `stage`, and `stageId` within a time window before creating

**Files to Modify**:
- `nectaria-services/src/lead-service/src/functions/leads/updateStageInternal.ts`
- `nectaria-services/src/lead-service/src/services/cosmosService.ts`

## Implementation Priority

1. **CRITICAL**: Fix duplicate event processing (Solution 1)
2. **HIGH**: Fix initial stage and timeline order (Solution 3)
3. **HIGH**: Fix race condition in idempotency check (Solution 2)
4. **MEDIUM**: Improve timeline deduplication (Solution 4)

## Testing Strategy

1. **Test Duplicate Event Processing**: Send the same event via both HTTP fallback and Event Grid, verify only one timeline entry is created
2. **Test Race Condition**: Send multiple stage update requests simultaneously, verify only one timeline entry is created
3. **Test Initial Stage**: Create a new lead, verify it starts at "Lead Created" with correct timeline order
4. **Test Timeline Order**: Verify timeline entries are in chronological order: Lead Created → Plans Fetching → Plans Available

## Evidence from Logs

### Duplicate Event Processing
- `lead.created`: Processed via HTTP fallback AND Event Grid
- `plans.fetch_started`: Processed via HTTP fallback (2x) AND Event Grid (multiple times with different event IDs)
- `plans.fetch_completed`: Processed via HTTP fallback AND Event Grid (multiple times)

### Multiple Stage Updates
- "Plans Fetching" stage updated 6 times within 1 second
- "Plans Available" stage updated 3 times within 1 second

### Timeline Order Issue
- Initial timeline entry: "Plans Fetching" (from createLead)
- Then: "Lead Created" (from pipeline)
- Then: "Plans Fetching" (from pipeline - duplicate!)
- Then: "Plans Available" (from pipeline)

