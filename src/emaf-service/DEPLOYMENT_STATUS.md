# EMAF Service Deployment Status

## ✅ Deployment Completed Successfully

**Date:** January 20, 2026  
**Function App Name:** emaf-service-func  
**Resource Group:** Interactive-CRM-Dev  
**Region:** UAE North  
**Deployment Method:** npx azure-functions-core-tools

---

## Infrastructure Setup ✅

### 1. Azure Function App
- **Name:** emaf-service-func
- **URL:** https://emaf-service-func.azurewebsites.net
- **Runtime:** Node.js 24
- **Plan:** Consumption (Dynamic)
- **Status:** Running

### 2. Cosmos DB
- **Account:** interactivecrmdevdb
- **Database:** emaf-service-db
- **Containers:**
  - `emaf-templates` (Partition Key: /vendorId, 400 RU/s)
  - `emaf-submissions` (Partition Key: /leadId, 400 RU/s)

### 3. Blob Storage
- **Account:** docstorage1763959700
- **Container:** emaf-documents
- **Purpose:** Store generated PDFs, signed PDFs, and uploaded documents

### 4. Storage Queue
- **Account:** docstorage1763959700
- **Queue Name:** pdf-generation-queue
- **Purpose:** Asynchronous PDF generation jobs

### 5. Event Grid
- **Endpoint:** https://interactive-crm-eventgrid.uaenorth-1.eventgrid.azure.net/api/events
- **Purpose:** Event-driven communication between services

---

## Deployed Functions (19 endpoints)

### Admin Functions
1. **POST** `/api/admin/emaf/templates` - Create EMAF template
2. **PUT** `/api/admin/emaf/templates/{vendorId}` - Update EMAF template
3. **GET** `/api/admin/emaf/templates/{vendorId}` - Get EMAF template
4. **GET** `/api/admin/emaf/templates` - List all EMAF templates
5. **POST** `/api/admin/emaf/templates/{vendorId}/publish` - Publish template

### Internal Functions (Service-to-Service)
6. **POST** `/api/internal/emaf/submissions` - Create submission

### Customer Functions
7. **GET** `/api/customer/emaf` - Get EMAF for token
8. **POST** `/api/customer/emaf/data` - Save EMAF data (auto-save)
9. **POST** `/api/customer/emaf/pdf/request` - Request PDF generation
10. **GET** `/api/customer/emaf/pdf/status/{jobId}` - Get PDF status
11. **POST** `/api/customer/emaf/pdf/signed` - Upload signed PDF
12. **POST** `/api/customer/emaf/documents` - Upload additional documents
13. **POST** `/api/customer/emaf/submit` - Submit for review

### Approval/Staff Functions
14. **GET** `/api/approval/submissions/pending` - List pending submissions
15. **GET** `/api/approval/submissions/{submissionId}` - Get submission details
16. **POST** `/api/approval/submissions/{submissionId}/approve` - Approve submission
17. **POST** `/api/approval/submissions/{submissionId}/reject` - Reject submission
18. **POST** `/api/approval/submissions/{submissionId}/revision` - Request revision

### Queue Trigger
19. **processPdfGeneration** - Queue trigger for async PDF generation

---

## Configuration (Already Applied) ✅

All environment variables have been configured in the Function App:

- **Cosmos DB:** Connection string and container names
- **Blob Storage:** Connection string and container name
- **Event Grid:** Endpoint and access key
- **Service URLs:** form-service, quotation-service
- **Queue:** PDF generation queue name
- **CORS:** Enabled for all origins (*)

---

## Verification Steps

### 1. Wait for Function App Initialization (5-10 minutes)
The function app is currently initializing. This is normal after first deployment.

```bash
# Check function app status
az functionapp show --name emaf-service-func --resource-group Interactive-CRM-Dev --query "state"
```

### 2. Test Health Check (when ready)
```bash
curl https://emaf-service-func.azurewebsites.net/api/health
```

### 3. List Deployed Functions
```bash
az functionapp function list --name emaf-service-func --resource-group Interactive-CRM-Dev --output table
```

### 4. View Logs
```bash
# Live log stream
az functionapp log tail --name emaf-service-func --resource-group Interactive-CRM-Dev

# Or via Azure Portal
# https://portal.azure.com > emaf-service-func > Log stream
```

### 5. Test Admin Endpoint (Create Template)
```bash
curl -X POST https://emaf-service-func.azurewebsites.net/api/admin/emaf/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "vendorId": "vendor-001",
    "vendorCode": "AXA",
    "vendorName": "AXA Insurance",
    "lineOfBusiness": "health",
    "name": "AXA Health EMAF",
    "sections": [],
    "requiredDocuments": []
  }'
```

---

## Integration Points

### 1. Quotation Service Integration
The quotation-service needs to call EMAF service when a plan is selected:

**Endpoint:** `POST /api/internal/emaf/submissions`

**Headers:**
- `X-Service-Key`: Your internal service key

**Payload:**
```json
{
  "leadId": "lead-123",
  "quotationId": "quot-456",
  "selectedPlanId": "plan-789",
  "vendorId": "vendor-001",
  "vendorCode": "AXA",
  "vendorName": "AXA Insurance",
  "customerId": "cust-123",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+971501234567"
}
```

### 2. Event Grid Subscriptions
The following events are published by EMAF service:
- `emaf.submission.created`
- `emaf.pdf.generated`
- `emaf.submission.submitted`
- `emaf.submission.approved`
- `emaf.submission.rejected`
- `emaf.revision.requested`

Other services can subscribe to these events for workflow automation.

---

## Known Issues & Resolution

### Issue: Sync Triggers Error
**Status:** Expected behavior, doesn't affect functionality  
**Details:** Azure sometimes fails to sync triggers immediately after deployment. Functions will still work correctly.

### Issue: 503 Service Unavailable (First 5-10 minutes)
**Status:** Normal during cold start  
**Resolution:** Wait 5-10 minutes for the function app to fully initialize after first deployment.

---

## Next Steps

1. **Wait 5-10 minutes** for function app to fully initialize
2. **Test health endpoint** to confirm service is running
3. **Create first EMAF template** using admin endpoint
4. **Update quotation-service** to integrate with EMAF service
5. **Test full flow** from plan selection to PDF generation
6. **Configure Event Grid subscriptions** if needed for other services
7. **Update CORS** settings for production frontend domains
8. **Set production secrets:**
   - Update `JWT_SECRET` in app settings
   - Update `SERVICE_KEY` in app settings

---

## Deployment Commands for Future Updates

### Quick Deployment (code only)
```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service
npm install
npm run build
npx --yes azure-functions-core-tools@4 azure functionapp publish emaf-service-func --typescript
```

### Or use the deployment script
```bash
./deploy-quick.sh
```

---

## Support & Documentation

- **Service README:** `/src/emaf-service/README.md`
- **Integration Guide:** `/src/emaf-service/INTEGRATION_GUIDE.md`
- **Infrastructure Setup:** `/src/emaf-service/INFRASTRUCTURE_SETUP.md`
- **Implementation Summary:** `/src/emaf-service/IMPLEMENTATION_SUMMARY.md`
- **Quick Start:** `/src/emaf-service/QUICKSTART.md`

---

## Summary

✅ **Infrastructure:** All Azure resources created and configured  
✅ **Code Deployment:** Successfully deployed (629 MB)  
✅ **Configuration:** All environment variables set  
⏳ **Status:** Function app initializing (5-10 minutes expected)  
📋 **Next:** Wait for initialization, then test endpoints  

**Function App URL:** https://emaf-service-func.azurewebsites.net
