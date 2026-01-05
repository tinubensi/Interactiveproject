# Enhanced Pipeline Deployment Validation Checklist

This checklist ensures all components of the enhanced pipeline are correctly implemented and ready for deployment.

## ✅ Pre-Deployment Validation

### Code Implementation

- [x] Enhanced pipeline definition created (`seedEnhancedPipeline.ts`)
- [x] Seed script implemented (`scripts/seedEnhancedPipeline.ts`)
- [x] Quotation Generation Service action handler (`handlePipelineAction.ts`)
- [x] Quotation Service action handler (`handlePipelineAction.ts`)
- [x] Policy Service action handler (`handlePipelineAction.ts`)
- [x] Service completion utilities (`publishCompletion.ts` in all 3 services)
- [x] Event constants updated in pipeline service (`predefined.ts`)
- [x] Event Grid subscription script (`setup-enhanced-pipeline-subscriptions.sh`)

### Tests

- [x] Unit tests for pipeline orchestrator (`enhanced-orchestrator.test.ts`)
- [x] Unit tests for quotation-gen handler (`handlePipelineAction.test.ts`)
- [x] Unit tests for quotation service handler (`handlePipelineAction.test.ts`)
- [x] Unit tests for policy service handler (`handlePipelineAction.test.ts`)
- [x] Integration tests (`enhanced-pipeline-flow.test.ts`)
- [x] E2E tests (`enhanced-pipeline-e2e.test.ts`)

### Documentation

- [x] Deployment guide (`ENHANCED_PIPELINE_DEPLOYMENT.md`)
- [x] Cleanup script (`clean-pipeline-data.ts`)
- [x] Validation checklist (this file)

## 🔍 Pre-Flight Checks

Before deploying, verify:

### Environment Configuration

```bash
# Check Azure CLI
az --version
az account show

# Check Node.js version
node --version  # Should be 18+

# Check Azure Functions Core Tools
func --version  # Should be 4.x
```

### Service Configuration

#### Pipeline Service
- [ ] Environment variables set:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `COSMOS_DATABASE_NAME`
  - `EVENTGRID_TOPIC_ENDPOINT`
  - `EVENTGRID_TOPIC_KEY`
  - `LEAD_SERVICE_URL`
  - `QUOTATION_GEN_SERVICE_URL`
  - `QUOTATION_SERVICE_URL`
  - `POLICY_SERVICE_URL`

#### Quotation Generation Service
- [ ] Environment variables set:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `EVENTGRID_TOPIC_ENDPOINT`
  - `EVENTGRID_TOPIC_KEY`
  - Vendor API credentials

#### Quotation Service
- [ ] Environment variables set:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `EVENTGRID_TOPIC_ENDPOINT`
  - `EVENTGRID_TOPIC_KEY`
  - Email service credentials (SMTP)

#### Policy Service
- [ ] Environment variables set:
  - `COSMOS_ENDPOINT`
  - `COSMOS_KEY`
  - `EVENTGRID_TOPIC_ENDPOINT`
  - `EVENTGRID_TOPIC_KEY`
  - Policy vendor API credentials

### Build Verification

```bash
# Build all services
cd nectaria-services

# Pipeline Service
cd src/pipeline-service && npm install && npm run build && cd ../..

# Quotation Generation Service
cd src/quotation-generation-service && npm install && npm run build && cd ../..

# Quotation Service
cd src/quotation-service && npm install && npm run build && cd ../..

# Policy Service
cd src/policy-service && npm install && npm run build && cd ../..
```

**All builds should complete without errors.**

## 🚀 Deployment Steps

### 1. Deploy Services

```bash
# Deploy each service (check each box after successful deployment)
```

- [ ] Quotation Generation Service deployed
  ```bash
  cd src/quotation-generation-service
  func azure functionapp publish func-nectaria-quotation-gen-dev --typescript
  ```

- [ ] Quotation Service deployed
  ```bash
  cd src/quotation-service
  func azure functionapp publish func-nectaria-quotation-dev --typescript
  ```

- [ ] Policy Service deployed
  ```bash
  cd src/policy-service
  func azure functionapp publish func-nectaria-policy-dev --typescript
  ```

- [ ] Pipeline Service deployed
  ```bash
  cd src/pipeline-service
  func azure functionapp publish func-nectaria-pipeline-dev --typescript
  ```

### 2. Verify Function Registration

```bash
# Check each service has the new functions
```

- [ ] `HandleFetchPlansAction` registered in Quotation Gen Service
  ```bash
  az functionapp function list \
    --resource-group nectaria-rg-dev \
    --name func-nectaria-quotation-gen-dev \
    --query "[?name=='HandleFetchPlansAction']"
  ```

- [ ] `HandleSendQuotationAction` registered in Quotation Service
  ```bash
  az functionapp function list \
    --resource-group nectaria-rg-dev \
    --name func-nectaria-quotation-dev \
    --query "[?name=='HandleSendQuotationAction']"
  ```

- [ ] `HandleIssuePolicyAction` registered in Policy Service
  ```bash
  az functionapp function list \
    --resource-group nectaria-rg-dev \
    --name func-nectaria-policy-dev \
    --query "[?name=='HandleIssuePolicyAction']"
  ```

### 3. Clean Existing Data

- [ ] Backup existing pipeline data (if needed)
- [ ] Run cleanup script with --force flag
  ```bash
  cd src/pipeline-service
  npx ts-node scripts/clean-pipeline-data.ts --force
  ```
- [ ] Verify cleanup completed successfully

### 4. Seed Enhanced Pipeline

- [ ] Run seed script
  ```bash
  npx ts-node scripts/seedEnhancedPipeline.ts
  ```
- [ ] Verify pipeline created with version 2
- [ ] Confirm pipeline is active (`isActive: true`)

### 5. Setup Event Grid Subscriptions

- [ ] Run Event Grid setup script
  ```bash
  cd /home/aravind/Projects/nectaria/nectaria-services
  ./scripts/setup-enhanced-pipeline-subscriptions.sh
  ```
- [ ] Verify 4 subscriptions created:
  - [ ] `action-fetch-plans`
  - [ ] `action-send-quotation`
  - [ ] `action-issue-policy`
  - [ ] `service-completions-to-pipeline`

## ✅ Post-Deployment Validation

### Smoke Tests

#### Test 1: Lead Creation → Plans Available

- [ ] Create test lead via Lead Service API
- [ ] Wait 10 seconds
- [ ] Verify pipeline instance created
  ```bash
  curl "https://{PIPELINE_SERVICE_URL}/api/pipeline/check/{LEAD_ID}"
  ```
- [ ] Expected: `currentStageName: "Lead Created"`, `progressPercent: 10`
- [ ] Wait 2-3 minutes
- [ ] Check pipeline again
- [ ] Expected: `currentStageName: "Plans Available"`, `progressPercent: 30`

#### Test 2: Quotation Creation → Email Sent

- [ ] Create quotation for lead with plans
- [ ] Wait 10 seconds
- [ ] Verify pipeline at "Quotation Created"
- [ ] Wait 1 minute
- [ ] Verify pipeline at "Quotation Sent"
- [ ] Verify email sent (check email service logs)

#### Test 3: Policy Issuance

- [ ] Approve quotation
- [ ] Wait 10 seconds
- [ ] Verify pipeline at "Approved"
- [ ] Wait 2-3 minutes
- [ ] Verify pipeline at "Policy Issued"
- [ ] Verify policy created in database

### Event Grid Validation

```bash
# Check Event Grid metrics
az monitor metrics list \
  --resource "/subscriptions/{SUBSCRIPTION_ID}/resourceGroups/nectaria-rg-dev/providers/Microsoft.EventGrid/topics/nectaria-eventgrid-topic-dev" \
  --metric "PublishSuccessCount,PublishFailCount,DeliverySuccessCount,DeliveryFailCount" \
  --start-time $(date -u -d '1 hour ago' '+%Y-%m-%dT%H:%M:%S') \
  --end-time $(date -u '+%Y-%m-%dT%H:%M:%S')
```

- [ ] `PublishSuccessCount` > 0
- [ ] `PublishFailCount` = 0
- [ ] `DeliverySuccessCount` > 0
- [ ] `DeliveryFailCount` = 0

### Log Validation

#### Pipeline Service Logs
```bash
az functionapp logs tail \
  --resource-group nectaria-rg-dev \
  --name func-nectaria-pipeline-dev
```

- [ ] Look for: `[ASYNC ACTION] Event published: pipeline.action.fetch_plans`
- [ ] Look for: `[SERVICE COMPLETION] Received service.fetch_plans.completed`
- [ ] No critical errors

#### Quotation Generation Service Logs
```bash
az functionapp logs tail \
  --resource-group nectaria-rg-dev \
  --name func-nectaria-quotation-gen-dev
```

- [ ] Look for: `[PIPELINE ACTION] fetch_plans for lead`
- [ ] Look for: `[PIPELINE ACTION] ✓ fetch_plans completed successfully`
- [ ] No critical errors

### Performance Validation

- [ ] Lead → Plans Available: < 3 minutes
- [ ] Quotation → Email sent: < 1 minute
- [ ] Approval → Policy issued: < 3 minutes
- [ ] Event Grid delivery latency: < 5 seconds

### Data Integrity Validation

- [ ] Pipeline instance has correct stages
- [ ] Lead Service updated with correct stages
- [ ] Plans stored in database
- [ ] Quotations created correctly
- [ ] Policies issued with correct data
- [ ] All timestamps populated
- [ ] Correlation IDs preserved

## 🔧 Rollback Criteria

Rollback if:

- ❌ Pipeline instances not created for new leads
- ❌ Plans not fetched after 5 minutes
- ❌ Email not sent after 2 minutes
- ❌ Policy not issued after 5 minutes
- ❌ Event Grid delivery failure rate > 5%
- ❌ Critical errors in service logs
- ❌ Database connection errors
- ❌ > 10% of requests failing

## 📊 Success Metrics

Deployment is successful when:

- ✅ 100% of test scenarios pass
- ✅ Event Grid delivery success rate > 95%
- ✅ No critical errors in logs
- ✅ Pipeline completion rate > 90%
- ✅ Average lead-to-policy time < 10 minutes
- ✅ All stages update correctly
- ✅ Correlation IDs tracked throughout

## 📝 Deployment Log

### Deployment Information

- **Deployment Date**: ________________
- **Deployed By**: ________________
- **Environment**: Dev / Staging / Production (circle one)
- **Git Commit**: ________________

### Deployment Results

- **Services Deployed**: _____ / 4
- **Event Grid Subscriptions Created**: _____ / 4
- **Tests Passed**: _____ / _____
- **Smoke Tests Passed**: _____ / 3

### Issues Encountered

1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

### Resolution Actions

1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

### Sign-Off

- **Tech Lead**: ________________  Date: ________
- **DevOps Lead**: ________________  Date: ________
- **QA Lead**: ________________  Date: ________

---

## 📞 Emergency Contacts

- **DevOps On-Call**: ________________
- **Backend Team Lead**: ________________
- **Azure Support**: ________________

## 🔗 Related Documents

- [Enhanced Pipeline Deployment Guide](./ENHANCED_PIPELINE_DEPLOYMENT.md)
- [Architecture Context](../docs/ARCHITECTURE_CONTEXT.MD)
- [Hybrid Sync/Async Architecture](./infra/HYBRID_SYNC_ASYNC_PIPELINE_ARCHITECTURE.md)
- [Complete Workflow Documentation](./infra/COMPLETE_WORKFLOW.md)

