# Document Service - Microservice Documentation

## 📋 Overview

The **Document Service** is a serverless microservice built on Azure Functions that manages document lifecycle, storage, and retrieval. It handles document uploads to Azure Blob Storage, generates secure SAS URLs for access, and implements automatic expiry through TTL and Change Feed triggers.

---

## 🏗️ Architecture

### Technology Stack
- **Runtime:** Node.js 20 (LTS)
- **Framework:** Azure Functions v4
- **Database:** Azure Cosmos DB (SQL API)
- **Storage:** Azure Blob Storage
- **Event Bus:** Azure Event Grid
- **Language:** TypeScript

### Design Patterns
- **Serverless Architecture:** Pay-per-execution model
- **Microservices:** Independent document management
- **Event-Driven:** Change Feed triggers and Event Grid
- **Secure Storage:** SAS URLs with short expiry

---

## 📊 Data Models

### Document Metadata
```typescript
{
  id: string;                    // Unique document ID (UUID)
  customerId: string;            // Partition key (owner)
  userId: string;                // User who uploaded
  documentType: DocumentType;    // Type of document
  fileName: string;              // Original filename
  blobPath: string;              // Path in blob storage
  expiryDate: string;            // ISO-8601 datetime
  ttl: number;                   // Time-to-live in seconds
  uploaded: boolean;             // Upload confirmation status
  createdAt: string;             // ISO-8601 datetime
}
```

### Document Types
```typescript
type DocumentType = 
  | "Passport"
  | "EmiratesID"
  | "TradeLicense"
  | "PolicyWording"
  | "KnowledgeBase";
```

---

## 🔌 API Endpoints

### Document Management

#### **POST** `/api/customers/{customerId}/documents`
Create document metadata and get upload URL.

**Path Parameters:**
- `customerId`: Customer ID (UUID)

**Request Body:**
```json
{
  "userId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
  "documentType": "Passport",
  "fileName": "passport-scan.pdf",
  "expiryDate": "2025-12-31T23:59:59Z"
}
```

**Response (201):**
```json
{
  "documentId": "15d50240-d91a-4abf-aba1-e3015562f074",
  "uploadUrl": "https://docstorage.blob.core.windows.net/...",
  "expiresIn": "15 minutes"
}
```

**Flow:**
1. Creates document metadata in Cosmos DB (status: `uploaded: false`)
2. Generates SAS URL for blob upload (valid 15 minutes)
3. Returns upload URL to client

---

#### **GET** `/api/customers/{customerId}/documents`
List documents for a customer (with optional user filtering).

**Path Parameters:**
- `customerId`: Customer ID

**Query Parameters:**
- `userId` (optional): Filter by specific user

**Response (200):**
```json
{
  "documents": [
    {
      "id": "15d50240-d91a-4abf-aba1-e3015562f074",
      "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
      "userId": "user-123",
      "documentType": "Passport",
      "fileName": "passport-scan.pdf",
      "blobPath": "a8f2a507.../15d50240.../passport-scan.pdf",
      "expiryDate": "2025-12-31T23:59:59Z",
      "uploaded": true,
      "createdAt": "2025-11-24T10:30:00Z"
    }
  ]
}
```

---

#### **POST** `/api/documents/{docId}/confirm-upload`
Confirm successful blob upload.

**Path Parameters:**
- `docId`: Document ID

**Response (200):**
```json
{
  "message": "Upload confirmed",
  "document": {
    "id": "15d50240-d91a-4abf-aba1-e3015562f074",
    "uploaded": true,
    ...
  }
}
```

**Flow:**
1. Updates document status to `uploaded: true`
2. Publishes `document.uploaded` event to Event Grid

---

#### **GET** `/api/documents/{docId}/preview`
Get temporary URL for document preview (opens in browser).

**Path Parameters:**
- `docId`: Document ID

**Response (200):**
```json
{
  "url": "https://docstorage.blob.core.windows.net/...?sv=...",
  "expiresIn": "15 minutes"
}
```

**Note:** URL does NOT force download, allows inline preview.

---

#### **GET** `/api/documents/{docId}/download`
Get temporary URL for document download (forces download).

**Path Parameters:**
- `docId`: Document ID

**Response (200):**
```json
{
  "url": "https://docstorage.blob.core.windows.net/...?sv=...",
  "expiresIn": "15 minutes"
}
```

**Note:** URL includes `Content-Disposition: attachment` header to force download.

---

#### **DELETE** `/api/documents/{docId}`
Delete document metadata and blob file.

**Path Parameters:**
- `docId`: Document ID

**Response (200):**
```json
{
  "message": "Document deleted successfully"
}
```

**Flow:**
1. Retrieves document metadata from Cosmos DB
2. Deletes blob file from storage
3. Deletes document metadata from Cosmos DB
4. Publishes `document.deleted` event

---

## 🎯 Features

### 1. **Secure Document Storage**
- **Azure Blob Storage:** Scalable, durable file storage
- **SAS URLs:** Short-lived (15 min), scoped access tokens
- **Path Structure:** `{customerId}/{documentId}/{fileName}`
- **User Isolation:** Documents tagged with `userId` for audit

### 2. **Document Lifecycle Management**
- **Upload Flow:**
  1. Client requests upload URL
  2. Client uploads directly to blob storage (no server relay)
  3. Client confirms upload
  4. Service marks document as uploaded
  
- **Access Flow:**
  1. Client requests preview/download URL
  2. Service generates SAS URL with read permissions
  3. Client accesses blob directly

- **Deletion Flow:**
  1. Service deletes blob from storage
  2. Service deletes metadata from Cosmos DB
  3. Event published for other services

### 3. **Automatic Expiry (TTL)**
- Documents have configurable expiry dates
- Cosmos DB TTL automatically deletes expired metadata
- Change Feed trigger publishes `document.expired` event
- **Note:** Blob cleanup can be handled via lifecycle policies or event subscribers

### 4. **Change Feed Processing**
- Monitors Cosmos DB for document changes
- Detects expiry (TTL-based deletion)
- Publishes `document.expired` events
- Enables reactive workflows

### 5. **Multi-Document Type Support**
- Passport, Emirates ID, Trade License
- Policy Wording, Knowledge Base
- Extensible type system

---

## ⚙️ Configuration

### Environment Variables

**Local Development (`local.settings.json`):**
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_ENDPOINT": "https://localhost:8081",
    "COSMOS_DB_KEY": "<emulator-key>",
    "COSMOS_DB_DATABASE_NAME": "DocumentDB",
    "COSMOS_DB_CONTAINER_NAME": "documents",
    "BLOB_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "BLOB_STORAGE_CONTAINER_NAME": "customerdocuments",
    "EVENT_GRID_TOPIC_ENDPOINT": "https://mock-event-grid.local",
    "EVENT_GRID_TOPIC_KEY": "mock-key"
  },
  "Host": {
    "CORS": "*",
    "CORSCredentials": false
  }
}
```

**Production (Azure App Settings):**
- Use real Azure Storage connection strings
- Use real Cosmos DB endpoint and keys
- Use real Event Grid topic endpoint

---

## 📦 Database Schema

### Cosmos DB Configuration
- **Database Name:** `DocumentDB`
- **Container Name:** `documents`
- **Partition Key:** `/customerId`
- **Default TTL:** Enabled (documents expire based on `ttl` field)
- **Indexing Policy:** Default

### Lease Container (Change Feed)
- **Container Name:** `leases`
- **Partition Key:** `/id`
- **Purpose:** Tracks Change Feed progress

---

## 📁 Blob Storage Structure

### Container: `customerdocuments`

**Path Format:**
```
{customerId}/{documentId}/{fileName}
```

**Example:**
```
a8f2a507-7cb7-451d-803e-cd7f6572cf28/
└── 15d50240-d91a-4abf-aba1-e3015562f074/
    └── passport-scan.pdf
```

### Benefits:
- Logical organization by customer
- Easy cleanup (delete all documents for a customer)
- Unique paths prevent collisions

---

## 🚀 Deployment

### Prerequisites
- Azure account
- Azure CLI installed
- Node.js 20 LTS
- Azure Functions Core Tools v4

### Deploy Script

**Run deployment script:**
```bash
cd document-service
chmod +x deploy.sh
./deploy.sh
```

**Or manually:**

1. **Create Resource Group:**
```bash
az group create --name document-service-rg --location uaenorth
```

2. **Create Storage Account (for blobs):**
```bash
az storage account create \
  --name docstorage$(date +%s) \
  --resource-group document-service-rg \
  --location uaenorth \
  --sku Standard_LRS \
  --kind StorageV2
```

3. **Create Blob Container:**
```bash
STORAGE_KEY=$(az storage account keys list \
  --account-name docstorage123456 \
  --resource-group document-service-rg \
  --query "[0].value" -o tsv)

az storage container create \
  --name customerdocuments \
  --account-name docstorage123456 \
  --account-key $STORAGE_KEY \
  --public-access off
```

4. **Configure CORS for Blob Storage:**
```bash
az storage cors add \
  --services b \
  --methods GET PUT POST DELETE OPTIONS \
  --origins "*" \
  --allowed-headers "*" \
  --exposed-headers "*" \
  --max-age 3600 \
  --account-name docstorage123456 \
  --account-key $STORAGE_KEY
```

5. **Create Cosmos DB Account:**
```bash
az cosmosdb create \
  --name document-cosmos-db \
  --resource-group document-service-rg \
  --locations regionName=uaenorth
```

6. **Create Database and Containers:**
```bash
# Create database
az cosmosdb sql database create \
  --account-name document-cosmos-db \
  --resource-group document-service-rg \
  --name DocumentDB

# Create documents container with TTL
az cosmosdb sql container create \
  --account-name document-cosmos-db \
  --database-name DocumentDB \
  --resource-group document-service-rg \
  --name documents \
  --partition-key-path "/customerId" \
  --ttl -1

# Create leases container (for Change Feed)
az cosmosdb sql container create \
  --account-name document-cosmos-db \
  --database-name DocumentDB \
  --resource-group document-service-rg \
  --name leases \
  --partition-key-path "/id"
```

7. **Create Function App:**
```bash
az functionapp create \
  --resource-group document-service-rg \
  --name document-service-func \
  --storage-account docstorage123456 \
  --consumption-plan-location uaenorth \
  --runtime node \
  --runtime-version 20 \
  --functions-version 4
```

8. **Configure App Settings:**
```bash
COSMOS_CONNECTION=$(az cosmosdb keys list \
  --name document-cosmos-db \
  --resource-group document-service-rg \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" -o tsv)

BLOB_CONNECTION=$(az storage account show-connection-string \
  --name docstorage123456 \
  --resource-group document-service-rg \
  --query connectionString -o tsv)

az functionapp config appsettings set \
  --name document-service-func \
  --resource-group document-service-rg \
  --settings \
  COSMOS_DB_CONNECTION_STRING="$COSMOS_CONNECTION" \
  COSMOS_DB_DATABASE_NAME="DocumentDB" \
  COSMOS_DB_CONTAINER_NAME="documents" \
  BLOB_STORAGE_CONNECTION_STRING="$BLOB_CONNECTION" \
  BLOB_STORAGE_CONTAINER_NAME="customerdocuments"
```

9. **Deploy Code:**
```bash
cd document-service
npm install
npm run build
func azure functionapp publish document-service-func
```

---

## 🧪 Local Development

### Setup

1. **Install Dependencies:**
```bash
cd document-service
npm install
```

2. **Start Cosmos DB Emulator:**
```bash
# Windows: Start from Start Menu
# Linux/Mac: Use Docker
docker run -p 8081:8081 mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator
```

3. **Start Azurite (Blob Emulator):**
```bash
npm install -g azurite
azurite --silent --location ./azurite-data --debug ./azurite-debug.log
```

4. **Create Local Database:**
- Access Cosmos emulator: https://localhost:8081/_explorer/index.html
- Create database `DocumentDB`
- Create containers `documents` (partition: `/customerId`, TTL: enabled) and `leases`

5. **Configure Environment:**
- Copy `local.settings.json.example` to `local.settings.json`
- Update connection strings if needed

6. **Start Service:**
```bash
npm start
```

Service runs on: `http://localhost:7072`

---

## 📝 Testing

### Test Document Upload Flow

**Step 1: Create document and get upload URL**
```bash
curl -X POST http://localhost:7072/api/customers/test-customer-123/documents \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "documentType": "Passport",
    "fileName": "passport.pdf",
    "expiryDate": "2025-12-31T23:59:59Z"
  }'
```

**Response:**
```json
{
  "documentId": "15d50240-d91a-4abf-aba1-e3015562f074",
  "uploadUrl": "https://127.0.0.1:10000/devstoreaccount1/...",
  "expiresIn": "15 minutes"
}
```

**Step 2: Upload file to blob storage**
```bash
curl -X PUT "<uploadUrl>" \
  -H "x-ms-blob-type: BlockBlob" \
  --data-binary @./passport.pdf
```

**Step 3: Confirm upload**
```bash
curl -X POST http://localhost:7072/api/documents/15d50240-d91a-4abf-aba1-e3015562f074/confirm-upload
```

**Step 4: List documents**
```bash
curl http://localhost:7072/api/customers/test-customer-123/documents
```

**Step 5: Get preview URL**
```bash
curl http://localhost:7072/api/documents/15d50240-d91a-4abf-aba1-e3015562f074/preview
```

**Step 6: Get download URL**
```bash
curl http://localhost:7072/api/documents/15d50240-d91a-4abf-aba1-e3015562f074/download
```

**Step 7: Delete document**
```bash
curl -X DELETE http://localhost:7072/api/documents/15d50240-d91a-4abf-aba1-e3015562f074
```

---

## 🔒 Security Considerations

### Current Implementation
- ✅ SAS URLs with short expiry (15 minutes)
- ✅ Read-only SAS for preview/download
- ✅ Write-only SAS for upload
- ✅ User ID tracking for audit
- ⚠️ **Auth Level:** Currently `anonymous` for development

### Production Recommendations

1. **Enable Function-Level Authentication:**
   - Change `authLevel` to `function`
   - Require API keys for all requests

2. **Add JWT Middleware:**
   - Validate JWT tokens
   - Ensure `userId` matches token

3. **Restrict CORS:**
   - Remove wildcard (`*`)
   - Specify allowed origins

4. **Blob Storage Security:**
   - Disable public access (already configured)
   - Use HTTPS only
   - Rotate storage keys regularly

5. **Rate Limiting:**
   - Limit upload requests per user
   - Implement exponential backoff

---

## 📊 Monitoring & Logging

### Application Insights
- Function execution metrics
- Dependency tracking (Cosmos DB, Blob Storage)
- Exception tracking

### Key Metrics
- **Document Upload Rate:** Uploads per minute
- **SAS URL Requests:** Preview/download frequency
- **Storage Consumption:** Blob size growth
- **Cosmos DB RU Usage:** Cost optimization
- **Expired Documents:** TTL effectiveness

### Logging
```typescript
context.log('Document created', { documentId, customerId, userId });
context.log('Upload confirmed', { documentId });
context.error('Blob deletion failed', { error: err.message });
```

---

## 🔄 Event Grid Integration

### Published Events

#### **document.uploaded**
```json
{
  "eventType": "document.uploaded",
  "subject": "document/15d50240-d91a-4abf-aba1-e3015562f074",
  "dataVersion": "1.0",
  "data": {
    "documentId": "15d50240-d91a-4abf-aba1-e3015562f074",
    "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
    "userId": "user-123",
    "documentType": "Passport",
    "fileName": "passport.pdf"
  }
}
```

#### **document.deleted**
```json
{
  "eventType": "document.deleted",
  "subject": "document/15d50240-d91a-4abf-aba1-e3015562f074",
  "dataVersion": "1.0",
  "data": {
    "documentId": "15d50240-d91a-4abf-aba1-e3015562f074",
    "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28"
  }
}
```

#### **document.expired**
```json
{
  "eventType": "document.expired",
  "subject": "document/15d50240-d91a-4abf-aba1-e3015562f074",
  "dataVersion": "1.0",
  "data": {
    "documentId": "15d50240-d91a-4abf-aba1-e3015562f074",
    "customerId": "a8f2a507-7cb7-451d-803e-cd7f6572cf28",
    "expiryDate": "2025-11-24T10:30:00Z"
  }
}
```

---

## 🐛 Troubleshooting

### Issue: CORS Error in Browser
**Symptoms:** `No 'Access-Control-Allow-Origin' header`

**Solution:**
1. Configure CORS in `host.json` (Functions)
2. Configure CORS on Storage Account (Blob)
```bash
az storage cors add --services b --methods GET PUT POST DELETE OPTIONS \
  --origins "*" --allowed-headers "*" --exposed-headers "*" \
  --max-age 3600 --account-name <storage-name>
```

### Issue: Upload URL Expired
**Symptoms:** 403 Forbidden when uploading to blob

**Solution:**
- SAS URLs expire after 15 minutes
- Request a new upload URL
- Implement retry logic in client

### Issue: Document Not Found After Upload
**Symptoms:** 404 when confirming upload

**Solution:**
- Ensure `confirm-upload` is called with correct `documentId`
- Check if upload succeeded to blob storage
- Verify document exists in Cosmos DB

### Issue: Change Feed Not Triggering
**Symptoms:** No `document.expired` events

**Solution:**
- Verify Change Feed binding is enabled in production
- Check `leases` container exists
- Review Application Insights for errors

---

## 📚 Dependencies

```json
{
  "@azure/cosmos": "^4.0.0",
  "@azure/functions": "^4.0.0",
  "@azure/storage-blob": "^12.17.0",
  "@azure/eventgrid": "^5.0.0",
  "uuid": "^9.0.0"
}
```

---

## 🎯 Future Enhancements

- [ ] Implement virus scanning for uploaded files
- [ ] Add OCR for document text extraction
- [ ] Implement document versioning
- [ ] Add thumbnail generation for images/PDFs
- [ ] Implement blob lifecycle policies (auto-delete expired blobs)
- [ ] Add document encryption at rest
- [ ] Implement automated testing (Jest)
- [ ] Add metadata extraction (file size, mime type)
- [ ] Implement bulk upload/download
- [ ] Add document templates

---

## 📞 Support

For issues or questions:
- Check Application Insights logs
- Review Blob Storage metrics
- Review Cosmos DB query metrics
- Contact: devops@example.com

---

**Version:** 1.0.0  
**Last Updated:** November 2025  
**Maintained By:** Development Team
