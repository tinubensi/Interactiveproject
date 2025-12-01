# Document Service - Complete Workflows

## 📤 Document Upload Workflow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. POST /api/customers/{customerId}/documents
       │    Body: {documentType, fileName, expiryDate}
       ▼
┌──────────────────┐
│ CreateDocument   │
│   Function       │
└────┬─────────────┘
     │
     │ 2. Calculate TTL
     │    ttl = (expiryDate - now) in seconds
     │
     ├─────────────────────────────┐
     │                             │
     ▼                             ▼
┌──────────┐              ┌────────────────┐
│ Cosmos   │              │ Blob Storage   │
│   DB     │              │    Service     │
└──────────┘              └────────────────┘
│ 3. Save metadata        │ 4. Generate SAS
│    {id, customerId,     │    upload token
│     documentType,       │    (15 min)
│     fileName,           │
│     blobPath,           │
│     expiryDate,         │
│     ttl: 86400,         │
│     uploaded: false}    │
│                         │
└────────┬────────────────┘
         │
         │ 5. Return {documentId, uploadSasUri, blobPath}
         ▼
    ┌─────────────┐
    │   Client    │
    └──────┬──────┘
           │
           │ 6. PUT <uploadSasUri>
           │    Body: File binary data
           │    Headers: x-ms-blob-type: BlockBlob
           ▼
    ┌────────────────┐
    │ Azure Blob     │
    │  Storage       │
    └────────────────┘
           │
           │ 7. File uploaded
           │
           ▼
    ┌─────────────┐
    │   Client    │
    └──────┬──────┘
           │
           │ 8. POST /api/documents/{docId}/confirm-upload
           │    Body: {uploaded: true}
           ▼
    ┌──────────────────┐
    │ ConfirmUpload    │
    │   Function       │
    └────┬─────────────┘
         │
         │ 9. Update document
         │    uploaded = true
         ▼
    ┌──────────┐
    │ Cosmos   │
    │   DB     │
    └──────────┘
         │
         │ 10. Publish event
         ▼
    ┌──────────────┐
    │ Event Grid   │
    │  (Published) │
    └──────────────┘
         │
         │ Event: CustomerDocumentUploadedEvent
         │ {documentId, customerId, documentType, blobPath}
         │
         ▼
    [Event Consumers]
```

---

## 📥 Document Download Workflow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. GET /api/documents/{docId}/download
       │    Query: customerId={customerId}
       ▼
┌──────────────────┐
│ GetDownloadUrl   │
│   Function       │
└────┬─────────────┘
     │
     │ 2. Fetch document metadata
     ▼
┌──────────┐
│ Cosmos   │
│   DB     │
└──────┬───┘
       │
       │ 3. Return {id, customerId, blobPath, uploaded}
       ▼
┌──────────────────┐
│ GetDownloadUrl   │
│   Function       │
└────┬─────────────┘
     │
     │ 4. Validate uploaded = true
     │
     │ 5. Generate SAS download token (15 min)
     ▼
┌────────────────┐
│ Blob Storage   │
│    Service     │
└────┬───────────┘
     │
     │ 6. Return {downloadSasUri}
     ▼
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 7. GET <downloadSasUri>
       ▼
┌────────────────┐
│ Azure Blob     │
│  Storage       │
└────┬───────────┘
     │
     │ 8. Return file binary data
     ▼
┌─────────────┐
│   Client    │
│ (File saved)│
└─────────────┘
```

---

## 📋 List Documents Workflow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. GET /api/customers/{customerId}/documents
       ▼
┌──────────────────┐
│ ListDocuments    │
│   Function       │
└────┬─────────────┘
     │
     │ 2. Query by partition key (customerId)
     │    SELECT * FROM c WHERE c.customerId = @customerId
     ▼
┌──────────┐
│ Cosmos   │
│   DB     │
└──────┬───┘
       │
       │ 3. Return all documents for customer
       │    [{id, documentType, fileName, expiryDate, uploaded}, ...]
       ▼
┌──────────────────┐
│ ListDocuments    │
│   Function       │
└────┬─────────────┘
     │
     │ 4. Map to response format
     ▼
┌─────────────┐
│   Client    │
│ (List shown)│
└─────────────┘
```

---

## 🗑️ Document Deletion Workflow

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │
       │ 1. DELETE /api/documents/{docId}
       │    Query: customerId={customerId}
       ▼
┌──────────────────┐
│ DeleteDocument   │
│   Function       │
└────┬─────────────┘
     │
     │ 2. Fetch document metadata
     ▼
┌──────────┐
│ Cosmos   │
│   DB     │
└──────┬───┘
       │
       │ 3. Return {id, customerId, blobPath, uploaded}
       ▼
┌──────────────────┐
│ DeleteDocument   │
│   Function       │
└────┬─────────────┘
     │
     │ 4. If uploaded = true, delete blob
     ▼
┌────────────────┐
│ Azure Blob     │
│  Storage       │
└────┬───────────┘
     │
     │ 5. Blob deleted
     ▼
┌──────────────────┐
│ DeleteDocument   │
│   Function       │
└────┬─────────────┘
     │
     │ 6. Delete metadata from Cosmos
     ▼
┌──────────┐
│ Cosmos   │
│   DB     │
└──────┬───┘
       │
       │ 7. Document deleted
       ▼
┌─────────────┐
│   Client    │
│ (Success)   │
└─────────────┘
```

---

## ⏰ TTL Expiry & Change Feed Workflow

```
         ┌─────────────────────────────┐
         │  Cosmos DB Document         │
         │  {                          │
         │    id: "doc-123",           │
         │    customerId: "cust-456",  │
         │    ttl: 300  (5 minutes)    │
         │  }                          │
         └──────────┬──────────────────┘
                    │
         Time passes... TTL counts down
                    │
                    │ TTL reaches 60 seconds
                    ▼
         ┌─────────────────────────────┐
         │  Cosmos DB Change Feed      │
         │  (Document still exists)    │
         └──────────┬──────────────────┘
                    │
                    │ Change detected
                    ▼
         ┌─────────────────────────────┐
         │  DocumentChangeFeed         │
         │  Function (Triggered)       │
         └──────────┬──────────────────┘
                    │
                    │ Check: ttl < 60 && !_expiryEventPublished
                    │
                    │ Match found!
                    ▼
         ┌─────────────────────────────┐
         │  Event Grid Service         │
         │  publishDocumentExpiredEvent│
         └──────────┬──────────────────┘
                    │
                    │ Event: CustomerDocumentExpiredEvent
                    │ {documentId, customerId, documentType}
                    ▼
         ┌─────────────────────────────┐
         │  Event Grid Topic           │
         │  (Event Published)          │
         └──────────┬──────────────────┘
                    │
                    │
                    ▼
              [Event Consumers]
                    
                    
         Time passes... TTL reaches 0
                    │
                    ▼
         ┌─────────────────────────────┐
         │  Cosmos DB                  │
         │  (Document AUTO-DELETED)    │
         └─────────────────────────────┘
```

### Important TTL Notes:

1. **Change Feed Limitation:** 
   - Change Feed does NOT capture actual deletions
   - We detect documents BEFORE TTL deletion (when TTL < 60s)

2. **Production Alternatives:**
   ```
   Option 1: Soft Delete Pattern
   ─────────────────────────────
   1. Set deleted = true
   2. Change Feed detects this change
   3. Publish expiry event
   4. TTL deletes document later
   
   Option 2: Timer Trigger
   ────────────────────────
   1. Timer runs every minute
   2. Query for documents where ttl < 120
   3. Publish expiry events
   4. Mark events as published
   
   Option 3: Pre-emptive (Current)
   ────────────────────────────────
   1. Change Feed monitors all changes
   2. Detect documents with low TTL
   3. Publish event before actual deletion
   4. Mark event as published
   ```

---

## 🔄 Complete System Data Flow

```
┌──────────────────────────────────────────────────────────────┐
│                        CLIENT APPLICATION                     │
└───┬──────────┬──────────┬──────────┬──────────┬─────────────┘
    │          │          │          │          │
    │ POST     │ GET      │ GET      │ POST     │ DELETE
    │ create   │ list     │ download │ confirm  │ delete
    │          │          │          │          │
    ▼          ▼          ▼          ▼          ▼
┌──────────────────────────────────────────────────────────────┐
│                    AZURE FUNCTIONS (HTTP)                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ CreateDocument │ ListDocuments │ GetDownloadUrl      │   │
│  │ ConfirmUpload  │ DeleteDocument                      │   │
│  └────┬──────────────┬──────────────┬──────────┬────────┘   │
└───────┼──────────────┼──────────────┼──────────┼────────────┘
        │              │              │          │
        ▼              ▼              │          │
┌──────────────────────────────────┐ │          │
│      COSMOS DB SERVICE           │ │          │
│  • createDocument()              │ │          │
│  • getDocument()                 │ │          │
│  • listDocumentsByCustomer()    │ │          │
│  • updateDocument()              │ │          │
│  • deleteDocument()              │ │          │
└────────┬─────────────────────────┘ │          │
         │                           │          │
         ▼                           ▼          ▼
┌────────────────────┐    ┌──────────────────────────┐
│   COSMOS DB        │    │  BLOB STORAGE SERVICE    │
│   • documents      │    │  • generateUploadSasUri()│
│   • partition: /   │    │  • generateDownloadSas() │
│     customerId     │    │  • deleteBlob()          │
│   • TTL enabled    │    └────────┬─────────────────┘
└────────┬───────────┘             │
         │                         ▼
         │              ┌──────────────────────┐
         │              │  AZURE BLOB STORAGE  │
         │              │  • customerDocuments │
         │              │  • No public access  │
         │              └──────────────────────┘
         │
         │ Change Feed
         ▼
┌──────────────────────────────────┐
│ AZURE FUNCTIONS (CHANGE FEED)   │
│  DocumentChangeFeed              │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│   EVENT GRID SERVICE             │
│  • publishDocumentUploadedEvent()│
│  • publishDocumentExpiredEvent() │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│      AZURE EVENT GRID            │
│  • CustomerDocumentUploaded      │
│  • CustomerDocumentExpired       │
└────────┬─────────────────────────┘
         │
         ▼
    [External Event Consumers]
    • Notification Service
    • Audit Service
    • Analytics Service
    • etc.
```

---

## 🎯 Key Integration Points

### 1. Client → Functions
- **Protocol:** HTTPS
- **Auth:** Function keys (or Azure AD in production)
- **Format:** JSON request/response

### 2. Functions → Cosmos DB
- **SDK:** `@azure/cosmos`
- **Connection:** Connection string
- **Pattern:** Single partition queries for efficiency

### 3. Functions → Blob Storage
- **SDK:** `@azure/storage-blob`
- **Connection:** Connection string
- **Pattern:** SAS token generation (no direct file streaming)

### 4. Client → Blob Storage
- **Protocol:** Direct HTTPS with SAS token
- **Pattern:** Browser direct upload/download
- **Benefit:** No bandwidth through Functions

### 5. Functions → Event Grid
- **SDK:** `@azure/eventgrid`
- **Connection:** Endpoint + Key
- **Pattern:** Fire-and-forget event publishing

### 6. Cosmos DB → Change Feed Function
- **Trigger:** Built-in Functions binding
- **Pattern:** Lease-based processing
- **Lease Container:** Auto-created

---

## 📊 Sequence Diagrams

### Upload Sequence
```
Client          CreateDoc       CosmosDB    BlobService    BlobStorage    ConfirmUpload   EventGrid
  │                 │               │            │              │               │              │
  ├─POST create────>│               │            │              │               │              │
  │                 ├─save metadata>│            │              │               │              │
  │                 │<─saved────────┤            │              │               │              │
  │                 ├─generate SAS─────────────>│              │               │              │
  │                 │<─SAS URI──────────────────┤              │               │              │
  │<─201 {SAS URI}──┤               │            │              │               │              │
  │                 │               │            │              │               │              │
  ├─PUT file────────────────────────────────────────────────>│               │              │
  │<─201 OK──────────────────────────────────────────────────┤               │              │
  │                 │               │            │              │               │              │
  ├─POST confirm───────────────────────────────────────────────────────────>│              │
  │                 │               │            │              │               ├─update doc──>│
  │                 │               │            │              │               │<─updated─────┤
  │                 │               │            │              │               ├─publish─────────────>│
  │<─200 OK──────────────────────────────────────────────────────────────────┤              │
```

---

## 💡 Error Handling Flows

### Failed Upload Scenario
```
1. Client calls CreateDocument → Success (document created, uploaded=false)
2. Client attempts blob upload → FAILS (network error)
3. Document remains in Cosmos with uploaded=false
4. TTL eventually deletes the document (cleanup)
5. No CustomerDocumentUploadedEvent is published
```

### Partial Failure Handling
```
Scenario: Upload succeeds but ConfirmUpload fails

1. Document created (uploaded=false)
2. Blob uploaded successfully
3. ConfirmUpload called → FAILS (e.g., network error)
4. Client retries ConfirmUpload → Success (idempotent)
5. Event published

Result: Eventually consistent, no data loss
```

---

**Visual Guide Version:** 1.0  
**Last Updated:** November 2024

