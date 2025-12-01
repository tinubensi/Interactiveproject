# Architecture Documentation

## System Overview

The Document Service is a fully serverless microservice built on Azure Functions that manages document metadata, provides secure upload/download capabilities, and handles automatic document expiration.

## Architecture Diagram

```
┌─────────────┐
│   Client    │
│ Application │
└──────┬──────┘
       │
       │ HTTP Requests
       ▼
┌─────────────────────────────────────────┐
│      Azure Functions (HTTP Triggers)    │
│  ┌───────────────────────────────────┐  │
│  │ • CreateDocument                  │  │
│  │ • ListDocuments                   │  │
│  │ • GetDownloadUrl                  │  │
│  │ • ConfirmUpload                   │  │
│  │ • DeleteDocument                  │  │
│  └───────────────────────────────────┘  │
└──────┬─────────────┬──────────┬─────────┘
       │             │          │
       ▼             ▼          ▼
┌─────────────┐ ┌─────────┐ ┌────────────┐
│  Cosmos DB  │ │  Blob   │ │Event Grid  │
│ (Metadata)  │ │ Storage │ │  (Events)  │
│  + TTL      │ │         │ │            │
└──────┬──────┘ └─────────┘ └────────────┘
       │
       │ Change Feed
       ▼
┌─────────────────────────────────────────┐
│  Azure Functions (Change Feed Trigger)  │
│  ┌───────────────────────────────────┐  │
│  │ DocumentChangeFeed                │  │
│  │ (TTL Expiry Detection)            │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Components

### 1. HTTP Trigger Functions

#### CreateDocument
- **Purpose:** Initialize document metadata and provide secure upload URL
- **Flow:**
  1. Validate request (customerId, documentType, fileName, expiryDate)
  2. Generate unique documentId (UUID)
  3. Calculate TTL from expiryDate
  4. Create metadata record in Cosmos DB
  5. Generate short-lived SAS upload token (15 min)
  6. Return upload URL to client

#### ListDocuments
- **Purpose:** Retrieve all documents for a customer
- **Flow:**
  1. Query Cosmos DB with customerId as partition key
  2. Return list of documents with metadata

#### GetDownloadUrl
- **Purpose:** Provide secure download link
- **Flow:**
  1. Validate document exists and is uploaded
  2. Generate short-lived SAS download token (15 min)
  3. Return download URL

#### ConfirmUpload
- **Purpose:** Mark document as uploaded and trigger event
- **Flow:**
  1. Update document status in Cosmos DB
  2. Publish CustomerDocumentUploadedEvent to Event Grid

#### DeleteDocument
- **Purpose:** Remove document and cleanup storage
- **Flow:**
  1. Delete blob file from storage
  2. Delete metadata from Cosmos DB

### 2. Change Feed Trigger

#### DocumentChangeFeed
- **Purpose:** Monitor document changes and detect TTL expiry
- **Challenges:** Change Feed doesn't capture deletions directly
- **Current Implementation:**
  - Monitors documents with TTL < 60 seconds
  - Publishes CustomerDocumentExpiredEvent proactively
- **Alternative Approaches:**
  - Soft delete pattern with metadata flag
  - Timer-based scanner for near-expiry documents
  - Separate deletions tracking container

### 3. Data Stores

#### Cosmos DB
- **Container:** `documents`
- **Partition Key:** `/customerId`
- **TTL:** Enabled per-document
- **Indexes:** Default indexing on all properties

**Schema:**
```typescript
{
  id: string,
  customerId: string,      // Partition key
  documentType: string,
  fileName: string,
  blobPath: string,
  expiryDate: string,
  ttl: number,             // Seconds until expiry
  uploaded: boolean,
  createdAt: string
}
```

#### Blob Storage
- **Container:** `customerDocuments`
- **Path Structure:** `{customerId}/{documentId}/{fileName}`
- **Access:** SAS token-based
- **Security:** No public access

### 4. Event Grid

**Event Types:**

1. **CustomerDocumentUploadedEvent**
   - Triggered: When document upload is confirmed
   - Payload: documentId, customerId, documentType, blobPath

2. **CustomerDocumentExpiredEvent**
   - Triggered: When document TTL expires
   - Payload: documentId, customerId, documentType

## Security Model

### Authentication & Authorization
- Function-level authentication (function keys)
- Consider Azure AD for production
- API Management for advanced scenarios

### Data Access
- SAS tokens with minimal permissions
  - Upload: write + create only
  - Download: read only
- Short token lifetime (15 minutes)
- No permanent public access

### Network Security
- HTTPS only
- CORS configuration required for browser clients
- Consider VNet integration for enhanced security

## Scalability Considerations

### Cosmos DB
- Partition by customerId for optimal query performance
- Single-partition queries for listing documents
- Consider provisioned throughput vs. serverless based on usage

### Azure Functions
- Consumption plan scales automatically
- Consider Premium plan for:
  - VNet integration
  - Faster cold starts
  - Dedicated resources

### Blob Storage
- Unlimited scalability
- Consider hot/cool/archive tiers based on access patterns

## Performance Optimization

### Response Times
- CreateDocument: < 200ms (single Cosmos write)
- ListDocuments: < 100ms (single-partition query)
- GetDownloadUrl: < 50ms (SAS generation)
- ConfirmUpload: < 300ms (Cosmos update + Event Grid publish)
- DeleteDocument: < 200ms (Cosmos + Blob delete)

### Caching Opportunities
- Document metadata (short TTL)
- Customer document lists
- Connection pooling (built into SDK)

## Monitoring & Observability

### Key Metrics
- Function execution count
- Function duration
- Cosmos DB RU consumption
- Blob Storage transactions
- Event Grid publish success rate
- TTL-based deletions count

### Logging
- Structured logging in all functions
- Correlation IDs for request tracking
- Error tracking and alerting

### Application Insights
- Automatic integration with Azure Functions
- Custom telemetry for business metrics
- Distributed tracing

## Failure Handling

### Retry Policies
- HTTP triggers: Client-side retry recommended
- Change Feed: Built-in retry mechanism
- Event Grid: 24-hour retry with exponential backoff

### Idempotency
- CreateDocument: Use client-provided ID if needed
- ConfirmUpload: Safe to call multiple times
- DeleteDocument: Returns success even if already deleted

### Error Scenarios
- Cosmos DB unavailable → 500 error, client retry
- Blob Storage unavailable → 500 error, client retry
- Event Grid unavailable → Logged, operation continues
- Invalid input → 400 error, client correction needed

## Cost Optimization

### Consumption Model
- Functions: Pay per execution
- Cosmos DB: RU-based or serverless
- Blob Storage: Pay per GB stored + transactions
- Event Grid: Pay per event published

### Cost Reduction Tips
- Use Cosmos DB serverless for low/variable traffic
- Implement blob lifecycle policies (hot → cool → archive)
- Clean up expired documents promptly
- Monitor and optimize Cosmos DB queries

## Future Enhancements

### Potential Improvements
1. **Document Versioning:** Track document history
2. **Virus Scanning:** Integrate with anti-malware service
3. **Document Processing:** OCR, metadata extraction
4. **Advanced Search:** Full-text search capabilities
5. **Batch Operations:** Bulk upload/delete
6. **Audit Trail:** Comprehensive access logging
7. **Encryption:** Customer-managed keys
8. **Geographic Redundancy:** Multi-region deployment

### Integration Points
- **Azure Logic Apps:** Workflow automation
- **Azure Cognitive Services:** Document analysis
- **Azure Key Vault:** Secrets management
- **Azure Monitor:** Advanced monitoring and alerting

## Deployment Strategy

### Development
- Local development with Azurite (storage emulator)
- Cosmos DB emulator or shared dev instance
- Event Grid simulator or mock implementation

### Staging
- Separate Azure resources
- Production-like configuration
- Automated testing

### Production
- Blue-green deployment
- Deployment slots for zero-downtime
- Automated rollback on failure

## Compliance & Data Governance

### Data Residency
- Choose region based on requirements
- Consider multi-region for disaster recovery

### Data Retention
- TTL-based automatic deletion
- Consider backup strategy for long-term retention
- Soft delete for blob storage

### Audit & Compliance
- Enable Cosmos DB audit logging
- Blob Storage access logs
- Event Grid delivery tracking

---

**Last Updated:** November 2024
**Version:** 1.0.0

