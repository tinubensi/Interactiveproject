# EMAF Service - Electronic Medical Application Form Service

## Overview

The EMAF Service is a microservice that manages Electronic Medical Application Forms for insurance vendors. It provides APIs for:
- Creating and managing EMAF templates per vendor
- Customer form filling and submission
- Async PDF generation with queue processing
- Document upload management
- Staff approval workflow

## Architecture

### Technology Stack
- **Runtime:** Node.js 20 (LTS)
- **Framework:** Azure Functions v4
- **Database:** Azure Cosmos DB (NoSQL)
- **Storage:** Azure Blob Storage
- **Queue:** Azure Storage Queue
- **Event Bus:** Azure Event Grid
- **Language:** TypeScript
- **PDF Generation:** PDFKit

### Key Features
- ✅ Vendor-specific EMAF templates
- ✅ Form builder integration
- ✅ Async PDF generation with queue processing
- ✅ Document upload with SAS URLs
- ✅ Multi-step customer workflow
- ✅ Staff approval system
- ✅ Event-driven architecture

## Database Schema

### Cosmos DB Containers

#### 1. `emaf-templates` (Partition Key: `/vendorId`)
```json
{
  "id": "uuid",
  "emafId": "emaf-watania-1234567890",
  "vendorId": "vendor-watania",
  "vendorCode": "watania",
  "vendorName": "Watania International",
  "lineOfBusiness": "medical",
  "name": "Medical Application Form",
  "sections": [...],
  "requiredDocuments": [...],
  "status": "published",
  "version": 1
}
```

#### 2. `emaf-submissions` (Partition Key: `/leadId`)
```json
{
  "id": "uuid",
  "submissionId": "EMAF-1234567890-ABCD1234",
  "leadId": "lead-123",
  "quotationId": "quotation-456",
  "vendorId": "vendor-watania",
  "formData": {...},
  "uploadedDocuments": [...],
  "generatedPdfSasUrl": "https://...",
  "signedPdfBlobPath": "emaf-pdfs/...",
  "status": "pending_approval"
}
```

## API Endpoints

### Admin APIs

#### Create EMAF Template
```http
POST /api/admin/emaf/templates
Authorization: Bearer {token}

{
  "vendorId": "vendor-watania",
  "vendorCode": "watania",
  "vendorName": "Watania International",
  "lineOfBusiness": "medical",
  "name": "Medical Application Form",
  "sections": [...],
  "requiredDocuments": [...]
}
```

#### Get EMAF Template
```http
GET /api/admin/emaf/templates/{vendorId}
Authorization: Bearer {token}
```

#### List EMAF Templates
```http
GET /api/admin/emaf/templates?lineOfBusiness=medical&status=published
Authorization: Bearer {token}
```

#### Update EMAF Template
```http
PUT /api/admin/emaf/templates/{id}?vendorId={vendorId}
Authorization: Bearer {token}

{
  "name": "Updated Form Name",
  "sections": [...]
}
```

#### Publish EMAF Template
```http
POST /api/admin/emaf/templates/{id}/publish?vendorId={vendorId}
Authorization: Bearer {token}
```

### Customer APIs

#### Get EMAF for Token
```http
GET /api/customer/emaf/{token}
```

#### Save EMAF Data (Auto-save)
```http
POST /api/customer/emaf/{submissionId}/save

{
  "leadId": "lead-123",
  "formData": {
    "firstName": "John",
    "lastName": "Doe",
    ...
  }
}
```

#### Request PDF Generation
```http
POST /api/customer/emaf/{submissionId}/generate-pdf

{
  "leadId": "lead-123"
}

Response (202 Accepted):
{
  "success": true,
  "jobId": "uuid",
  "statusUrl": "/api/customer/emaf/{submissionId}/pdf-status"
}
```

#### Get PDF Status
```http
GET /api/customer/emaf/{submissionId}/pdf-status?leadId=lead-123

Response:
{
  "status": "completed",
  "pdfUrl": "https://storage.blob.core.windows.net/..."
}
```

#### Upload Signed PDF
```http
POST /api/customer/emaf/{submissionId}/signed-pdf?leadId=lead-123
Content-Type: multipart/form-data

[Binary PDF data]
```

#### Upload Document
```http
POST /api/customer/emaf/{submissionId}/documents?leadId=lead-123&documentRequirementId=doc-1&documentType=passport&fileName=passport.pdf&mimeType=application/pdf
Content-Type: multipart/form-data

[Binary file data]
```

#### Submit for Review
```http
POST /api/customer/emaf/{submissionId}/submit

{
  "leadId": "lead-123"
}
```

### Approval APIs

#### List Pending Submissions
```http
GET /api/emaf/submissions/pending?limit=50
Authorization: Bearer {token}
```

#### Get Submission
```http
GET /api/emaf/submissions/{id}?leadId=lead-123
Authorization: Bearer {token}
```

#### Approve Submission
```http
POST /api/emaf/submissions/{id}/approve?leadId=lead-123
Authorization: Bearer {token}

{
  "approvedBy": "staff-user-id",
  "reviewNotes": "Approved - all documents verified"
}
```

#### Reject Submission
```http
POST /api/emaf/submissions/{id}/reject?leadId=lead-123
Authorization: Bearer {token}

{
  "rejectedBy": "staff-user-id",
  "reviewNotes": "Missing required documents"
}
```

#### Request Revision
```http
POST /api/emaf/submissions/{id}/request-revision?leadId=lead-123
Authorization: Bearer {token}

{
  "requestedBy": "staff-user-id",
  "reviewNotes": "Please provide clearer passport copy"
}
```

### Internal APIs

#### Create Submission (Service-to-Service)
```http
POST /api/internal/submissions/create
X-Service-Key: {service-key}

{
  "leadId": "lead-123",
  "quotationId": "quotation-456",
  "selectedPlanId": "plan-789",
  "vendorId": "vendor-watania",
  "vendorCode": "watania",
  "vendorName": "Watania International",
  "customerId": "customer-123",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "+971501234567"
}
```

## Event Grid Events

### Published Events

#### 1. `emaf.submission.created`
```json
{
  "eventType": "emaf.submission.created",
  "subject": "/emaf/submissions/{submissionId}",
  "data": {
    "submissionId": "EMAF-...",
    "leadId": "lead-123",
    "quotationId": "quotation-456",
    "vendorId": "vendor-watania",
    "emafTemplateId": "template-id",
    "customerId": "customer-123",
    "customerEmail": "john@example.com"
  }
}
```

#### 2. `emaf.pdf.generated`
```json
{
  "eventType": "emaf.pdf.generated",
  "subject": "/emaf/submissions/{submissionId}",
  "data": {
    "submissionId": "EMAF-...",
    "leadId": "lead-123",
    "pdfUrl": "https://...",
    "pdfBlobPath": "emaf-pdfs/..."
  }
}
```

#### 3. `emaf.submission.submitted`
```json
{
  "eventType": "emaf.submission.submitted",
  "subject": "/emaf/submissions/{submissionId}",
  "data": {
    "submissionId": "EMAF-...",
    "leadId": "lead-123",
    "submittedAt": "2026-01-20T10:00:00Z",
    "hasSignedPdf": true,
    "uploadedDocumentsCount": 3
  }
}
```

#### 4. `emaf.submission.approved`
```json
{
  "eventType": "emaf.submission.approved",
  "subject": "/emaf/submissions/{submissionId}",
  "data": {
    "submissionId": "EMAF-...",
    "leadId": "lead-123",
    "approvedBy": "staff-user-id",
    "approvedAt": "2026-01-20T12:00:00Z",
    "reviewNotes": "Approved"
  }
}
```

## Setup and Configuration

### 1. Install Dependencies
```bash
cd Interactiveproject/src/emaf-service
npm install
```

### 2. Configure Local Settings
Update `local.settings.json`:
```json
{
  "Values": {
    "COSMOS_CONNECTION_STRING": "your-cosmos-connection-string",
    "BLOB_STORAGE_CONNECTION_STRING": "your-storage-connection-string",
    "EVENT_GRID_TOPIC_ENDPOINT": "your-event-grid-endpoint",
    "EVENT_GRID_TOPIC_KEY": "your-event-grid-key",
    "FORM_SERVICE_URL": "http://localhost:7073",
    "QUOTATION_SERVICE_URL": "http://localhost:7075"
  }
}
```

### 3. Create Azure Resources
```bash
# See INFRASTRUCTURE_SETUP.md for detailed Azure CLI commands
```

### 4. Build and Run
```bash
npm run build
npm start
```

Service runs on: `http://localhost:7078`

## Development

### Project Structure
```
src/
├── index.ts                 # Entry point
├── config.ts                # Configuration
├── models/
│   ├── emafTypes.ts        # Core types
│   └── events.ts           # Event definitions
├── functions/
│   ├── admin/              # Admin APIs
│   ├── customer/           # Customer APIs
│   ├── approval/           # Approval APIs
│   ├── queue/              # Queue processors
│   └── internal/           # Internal APIs
├── services/
│   ├── cosmosService.ts    # Cosmos DB operations
│   ├── queueService.ts     # Queue operations
│   ├── blobService.ts      # Blob storage operations
│   ├── pdfGeneratorService.ts  # PDF generation
│   ├── eventGridService.ts     # Event publishing
│   └── formServiceClient.ts    # Form service client
└── lib/
    ├── auth.ts             # Authentication
    ├── validation.ts       # Validation utilities
    └── corsHelper.ts       # CORS configuration
```

### Testing
```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## Integration Guide

### Integrate with Quotation Service

In `quotation-service/src/functions/customer/selectPlan.ts`, add EMAF check:

```typescript
// After plan selection
const selectedPlan = plans.find(p => p.id === planId);

// Check if vendor has EMAF
const emafResponse = await axios.get(
  `${process.env.EMAF_SERVICE_URL}/api/admin/emaf/templates/${selectedPlan.vendorId}`,
  {
    headers: {
      'X-Service-Key': process.env.SERVICE_KEY
    }
  }
);

if (emafResponse.status === 200) {
  // Create EMAF submission
  const submissionResponse = await axios.post(
    `${process.env.EMAF_SERVICE_URL}/api/internal/submissions/create`,
    {
      leadId, quotationId, selectedPlanId,
      vendorId, vendorCode, vendorName,
      customerId, customerName, customerEmail, customerPhone
    },
    {
      headers: {
        'X-Service-Key': process.env.SERVICE_KEY
      }
    }
  );
  
  // Update quotation with EMAF info
  await cosmosService.updateQuotation(quotationId, leadId, {
    requiresEmaf: true,
    emafSubmissionId: submissionResponse.data.data.submissionId
  });
  
  return {
    success: true,
    requiresEmaf: true,
    redirectUrl: `/quotation/${token}/emaf`
  };
}
```

## Deployment

### Azure Function App Deployment
```bash
# Build
npm run build

# Deploy to Azure
func azure functionapp publish emaf-service-app
```

## Monitoring

### Application Insights
- Request telemetry
- Dependency tracking
- Exception logging
- Custom metrics

### Queue Monitoring
```bash
# Check queue length
az storage queue stats --name pdf-generation-queue
```

## Troubleshooting

### Common Issues

#### PDF Generation Fails
- Check queue visibility timeout
- Verify PDFKit dependencies
- Check blob storage permissions

#### CORS Errors
- Update `host.json` with correct origins
- Verify CORS headers in responses

#### Authentication Issues
- Verify JWT secret configuration
- Check service key for internal calls

## License

Copyright © 2026 Insurance Portal. All rights reserved.
