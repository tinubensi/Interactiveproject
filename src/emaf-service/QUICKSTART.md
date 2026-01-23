# EMAF Service Quick Start Guide

## Get Started in 5 Minutes

### Prerequisites
- Node.js 20+
- Azure Functions Core Tools
- Azure Storage Emulator (Azurite) or Azure Storage Account
- Cosmos DB Emulator or Azure Cosmos DB account

### Step 1: Install Dependencies
```bash
cd Interactiveproject/src/emaf-service
npm install
```

### Step 2: Configure Local Settings
Create or update `local.settings.json`:
```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_CONNECTION_STRING": "AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv...",
    "COSMOS_DATABASE_NAME": "emaf-service-db",
    "COSMOS_TEMPLATES_CONTAINER": "emaf-templates",
    "COSMOS_SUBMISSIONS_CONTAINER": "emaf-submissions",
    "BLOB_STORAGE_CONNECTION_STRING": "UseDevelopmentStorage=true",
    "EVENT_GRID_TOPIC_ENDPOINT": "http://localhost:4010/api/events",
    "EVENT_GRID_TOPIC_KEY": "mock-key",
    "FORM_SERVICE_URL": "http://localhost:7073",
    "QUOTATION_SERVICE_URL": "http://localhost:7075",
    "SERVICE_KEY": "internal-service-key"
  }
}
```

### Step 3: Start Local Emulators
```bash
# Start Azurite (in separate terminal)
azurite

# Start Cosmos DB Emulator (if on Windows)
# Or use Azure Cosmos DB account
```

### Step 4: Build and Run
```bash
npm run build
npm start
```

Service starts on: **http://localhost:7078**

### Step 5: Test the API
```bash
# Health check (create a simple test)
curl http://localhost:7078/api/admin/emaf/templates

# Create a template
curl -X POST http://localhost:7078/api/admin/emaf/templates \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "vendorId": "vendor-test",
    "vendorCode": "test",
    "vendorName": "Test Vendor",
    "lineOfBusiness": "medical",
    "name": "Test Medical Application",
    "sections": [
      {
        "id": "section-1",
        "title": "Personal Information",
        "order": 1,
        "questions": [
          {
            "id": "q1",
            "label": "Full Name",
            "dataKey": "fullName",
            "type": "text",
            "order": 1,
            "validation": {
              "required": true
            }
          }
        ]
      }
    ],
    "requiredDocuments": [
      {
        "id": "doc-1",
        "documentType": "passport",
        "label": "Passport Copy",
        "required": true,
        "acceptedFormats": ["pdf", "jpg", "png"],
        "maxSizeInMB": 5
      }
    ]
  }'
```

## Common Commands

### Development
```bash
# Watch mode (auto-rebuild on changes)
npm run watch

# Build only
npm run build

# Start without build
npx func start --port 7078
```

### Testing
```bash
# Run tests (when implemented)
npm test

# Run with coverage
npm run test:coverage
```

### Deployment
```bash
# Deploy to Azure
func azure functionapp publish emaf-service-app
```

## Troubleshooting

### Port Already in Use
```bash
# Change port in package.json or run:
npx func start --port 7079
```

### Cosmos DB Connection Failed
- Check if Cosmos DB Emulator is running
- Verify connection string in local.settings.json
- Try using Azure Cosmos DB account instead

### Queue Not Working
- Ensure Azurite is running
- Check AzureWebJobsStorage connection string
- Verify queue name is correct: `pdf-generation-queue`

### PDF Generation Fails
- Check PDFKit installation: `npm list pdfkit`
- Verify form data structure matches template
- Check Azure Functions logs for errors

## Next Steps

1. Read [README.md](./README.md) for complete API documentation
2. Follow [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) to integrate with other services
3. Check [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md) for Azure deployment

## Quick Links

- **API Documentation**: See README.md
- **Integration Guide**: See INTEGRATION_GUIDE.md
- **Infrastructure**: See INFRASTRUCTURE_SETUP.md
- **Implementation Details**: See IMPLEMENTATION_SUMMARY.md

---

**Need Help?** Check the troubleshooting section or review the full documentation.
