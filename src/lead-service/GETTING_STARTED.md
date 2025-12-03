# Getting Started with Lead Service

## Overview

The Lead Service is the first microservice in the Insurance Platform, managing insurance leads across all lines of business (Medical/Pet, Motor, General, Marine). It's designed to be scalable, LOB-agnostic, and event-driven.

## Prerequisites

1. **Node.js 20 LTS** - [Download](https://nodejs.org/)
2. **Azure Functions Core Tools v4** - `npm install -g azure-functions-core-tools@4`
3. **Azure Cosmos DB Emulator** - [Download](https://aka.ms/cosmosdb-emulator) or use Docker
4. **Azurite** (Optional) - `npm install -g azurite`
5. **jq** (for testing) - `sudo apt-get install jq`

## Quick Start

### 1. Install Dependencies
```bash
cd /home/user/Desktop/project/azure/lead-service
npm install
```

### 2. Configure Local Settings
The `local.settings.json` is already configured for local development:
```json
{
  "Values": {
    "COSMOS_DB_ENDPOINT": "https://localhost:8081",
    "COSMOS_DB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "COSMOS_DB_NAME": "LeadDB",
    "EVENT_GRID_TOPIC_ENDPOINT": "http://localhost:4000",
    "EVENT_GRID_TOPIC_KEY": "local-dev-key"
  }
}
```

### 3. Start Cosmos DB Emulator
**Option A: Windows**
```bash
# Start Cosmos DB Emulator from Start Menu
```

**Option B: Docker**
```bash
docker run -p 8081:8081 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 \
  -m 3g --cpus=2.0 --name=cosmosdb-emulator \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator
```

### 4. Initialize Database
```bash
npm run setup
```

This will:
- Create Cosmos DB containers (leads, timelines, stages, metadata)
- Seed 8 stages
- Seed metadata (pet types, breeds, emirates, etc.)

### 5. Start the Service
```bash
npm start
```

The service will be available at `http://localhost:7071`

### 6. Test the API
```bash
npm run test:api
```

This runs a comprehensive test suite covering all endpoints.

## Project Structure

```
lead-service/
├── src/
│   ├── functions/          # Azure Functions
│   │   ├── leads/          # Lead CRUD operations
│   │   ├── timelines/      # Timeline operations
│   │   ├── stages/         # Stage operations
│   │   ├── metadata/       # Metadata operations
│   │   └── events/         # Event handlers
│   ├── services/           # Business logic
│   │   ├── cosmosService.ts
│   │   ├── eventGridService.ts
│   │   └── metadataService.ts
│   ├── models/             # TypeScript models
│   │   ├── lead.ts
│   │   ├── events.ts
│   │   └── metadata.ts
│   └── utils/              # Utilities
│       ├── validation.ts
│       └── referenceGenerator.ts
├── scripts/                # Setup and test scripts
├── package.json
├── tsconfig.json
├── host.json
└── local.settings.json
```

## Key Features

### 1. Multi-LOB Support
Handles all lines of business:
- **Medical**: Pet insurance (individual/group), Human medical (future)
- **Motor**: Vehicle insurance (individual/fleet)
- **General**: Property, liability insurance
- **Marine**: Cargo, hull, yacht insurance

### 2. Flexible Data Model
- Core fields common to all LOBs
- `lobData` field stores LOB-specific information dynamically
- Easy to add new LOBs without code changes

### 3. Advanced Search & Filtering
- Pagination (page, limit)
- Sorting (by any field, asc/desc)
- Global search across multiple fields
- Dynamic filters per LOB
- Aggregations and statistics

### 4. Timeline Tracking
- Every stage change tracked
- Remarks and context stored
- References to quotations and policies
- Audit trail for compliance

### 5. Event-Driven Architecture
- Publishes events for all lead operations
- Subscribes to events from other services
- Loose coupling between services
- Easy to add new subscribers

## Example Usage

### Create a Medical Lead (Pet Insurance)
```bash
curl -X POST http://localhost:7071/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "customerId": "customer-123",
    "firstName": "Ahmed",
    "lastName": "Ali",
    "email": "ahmed.ali@example.com",
    "phone": {
      "number": "+971501234567",
      "countryCode": "+971",
      "isoCode": "AE"
    },
    "emirate": "Dubai",
    "lobData": {
      "petName": "Max",
      "petType": "dog",
      "petGender": "male",
      "petBirthday": "2020-05-15",
      "petBreed": "Golden Retriever",
      "isPureBreed": true,
      "isMicrochipped": true,
      "microchipId": "123456789",
      "isNeutered": true,
      "hasHealthIssues": false,
      "weightInKg": 30
    },
    "source": "Website"
  }'
```

### Create a Motor Lead (Future)
```bash
curl -X POST http://localhost:7071/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "lineOfBusiness": "motor",
    "businessType": "individual",
    "customerId": "customer-456",
    "firstName": "Sara",
    "lastName": "Hassan",
    "email": "sara@example.com",
    "phone": {
      "number": "+971501234568",
      "countryCode": "+971",
      "isoCode": "AE"
    },
    "emirate": "Abu Dhabi",
    "lobData": {
      "vehicleType": "sedan",
      "make": "Toyota",
      "model": "Camry",
      "year": 2022,
      "plateNumber": "ABC-123",
      "vehicleValue": 75000
    },
    "source": "Referral"
  }'
```

### List Leads with Filters
```bash
curl -X POST http://localhost:7071/api/leads/list \
  -H "Content-Type: application/json" \
  -d '{
    "page": 1,
    "limit": 20,
    "sortBy": "createdAt",
    "sortOrder": "desc",
    "search": "ahmed",
    "filters": {
      "lineOfBusiness": ["medical"],
      "stageId": [1, 2],
      "isHotLead": false
    }
  }'
```

## Development Workflow

### 1. Make Code Changes
Edit files in `src/` directory

### 2. Build
```bash
npm run build
```

### 3. Watch Mode (Auto-rebuild)
```bash
npm run watch
```

### 4. Test Locally
```bash
npm start
# In another terminal:
npm run test:api
```

## Database Schema

### Containers

#### `leads` (Partition Key: `/lineOfBusiness`)
Stores all leads across all LOBs

#### `timelines` (Partition Key: `/leadId`)
Stores timeline entries for each lead

#### `stages` (Partition Key: `/id`)
Stores workflow stages

#### `metadata` (Partition Key: `/type`)
Stores all metadata: pet types, breeds, emirates, etc.

## Event Grid Integration

### Local Development
For local development, you can:
1. Use Azure Event Grid Emulator (if available)
2. Mock the Event Grid client
3. Use ngrok to tunnel to Azure Event Grid

### Published Events
- `lead.created`
- `lead.updated`
- `lead.stage_changed`
- `lead.assigned`
- `lead.deleted`
- `lead.hot_lead_marked`

### Subscribed Events
- `plans.fetch_completed` (from Quotation Generation Service)
- `quotation.created` (from Quotation Service)
- `policy.issued` (from Policy Service)

## Next Steps

1. ✅ Lead Service - **COMPLETED**
2. ⏳ Quotation Generation Service - **Next**
3. ⏳ Quotation Service
4. ⏳ Policy Service

## Troubleshooting

### Cosmos DB Connection Error
- Ensure Cosmos DB Emulator is running
- Check if port 8081 is available
- Verify the connection string in `local.settings.json`

### Port 7071 Already in Use
```bash
# Find process using port
lsof -i :7071
# Kill process
kill -9 <PID>
```

### Build Errors
```bash
# Clean and rebuild
npm run clean
npm run build
```

## Documentation

- [API.md](./API.md) - Complete API documentation
- [README.md](./README.md) - Service overview

## Support

For issues or questions, refer to the architecture documentation in `/home/user/Desktop/project/azure/ARCHITECTURE_OVERVIEW.md`


