# Getting Started - Quotation Generation Service

This guide will help you set up and run the Quotation Generation Service locally.

## Prerequisites

- Node.js 20.x or later
- Azure Cosmos DB Emulator or Azure Cosmos DB account
- Azure Storage Emulator (Azurite) or Azure Storage account
- Event Grid Mock/Emulator (optional for local development)

## Installation

1. **Navigate to service directory:**
```bash
cd azure/quotation-generation-service
```

2. **Install dependencies:**
```bash
npm install
```

## Configuration

### Environment Variables

Create or update `local.settings.json`:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "COSMOS_DB_ENDPOINT": "https://localhost:8081",
    "COSMOS_DB_KEY": "C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==",
    "COSMOS_DB_NAME": "PlanDB",
    "EVENT_GRID_TOPIC_ENDPOINT": "http://localhost:4000",
    "EVENT_GRID_TOPIC_KEY": "local-dev-key",
    "LEAD_SERVICE_URL": "http://localhost:7071/api"
  }
}
```

## Database Setup

### 1. Start Cosmos DB Emulator

**Windows:**
```bash
# Cosmos DB Emulator should auto-start
# Or launch from Start Menu
```

**Linux/Mac (using Docker):**
```bash
docker run -p 8081:8081 -p 10251:10251 -p 10252:10252 -p 10253:10253 -p 10254:10254 \
  -m 3g --cpus=2.0 \
  -e AZURE_COSMOS_EMULATOR_PARTITION_COUNT=10 \
  -e AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE=true \
  mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest
```

### 2. Create Database and Seed Data

```bash
npm run setup
```

This will:
- Create `PlanDB` database
- Create containers: `fetchRequests`, `plans`, `planFilters`, `planComparisons`, `vendors`
- Seed 3 vendors (Al Dhafra, Oman Insurance, Dubai Insurance)

## Running the Service

### Development Mode

```bash
# Build and start
npm start

# Or watch mode (auto-rebuild on changes)
npm run watch
# In another terminal:
func start --port 7072
```

Service will run on: **http://localhost:7072**

## Testing

### 1. Health Check

```bash
curl http://localhost:7072/api/vendors
```

### 2. Run Full Test Suite

```bash
chmod +x scripts/test-api.sh
./scripts/test-api.sh
```

### 3. Manual Testing

#### Fetch Plans
```bash
curl -X POST http://localhost:7072/api/plans/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-test-001",
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "leadData": {
      "petType": "Dog",
      "petBreed": "Golden Retriever",
      "petBirthday": "2020-01-15"
    }
  }'
```

#### List Plans
```bash
curl -X POST http://localhost:7072/api/plans/list \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-test-001",
    "page": 1,
    "limit": 10,
    "sortBy": "annualPremium",
    "sortOrder": "asc"
  }'
```

#### Create Comparison
```bash
curl -X POST http://localhost:7072/api/plans/compare \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "lead-test-001",
    "planIds": ["plan-lead-test-001-1", "plan-lead-test-001-2"]
  }'
```

## Project Structure

```
quotation-generation-service/
├── src/
│   ├── functions/
│   │   ├── plans/         # Plan fetching and management
│   │   ├── filters/       # Filter management
│   │   ├── comparisons/   # Plan comparison
│   │   ├── vendors/       # Vendor management
│   │   └── events/        # Event handlers
│   ├── models/
│   │   ├── plan.ts        # Plan data models
│   │   └── events.ts      # Event models
│   ├── services/
│   │   ├── cosmosService.ts        # Cosmos DB operations
│   │   ├── eventGridService.ts     # Event publishing
│   │   └── planFetchingService.ts  # Plan fetching logic
│   ├── data/
│   │   └── staticPlans.ts # Static plan data (3 medical plans)
│   └── index.ts           # Entry point
├── scripts/
│   ├── setup-database.ts  # Database setup
│   └── test-api.sh        # API tests
├── package.json
├── tsconfig.json
├── host.json
├── local.settings.json
├── API.md                 # API documentation
└── README.md
```

## Key Features

### 1. Static Plans (Initial Implementation)
- 3 pre-configured medical (pet) insurance plans
- Al Dhafra Insurance - Pet Care Essential (AED 1,500/year)
- Oman Insurance - Pet Care Premium (AED 2,500/year) ⭐ Recommended
- Dubai Insurance - Pet Care Comprehensive (AED 3,500/year)

### 2. Plan Fetching
- Auto-triggers when lead is created
- Manual trigger available via API
- Caching to avoid duplicate fetches
- RPA integration ready (not yet implemented)

### 3. Advanced Filtering
- Price range (annual/monthly premium)
- Coverage range (annual limit, deductible, co-insurance)
- Waiting period
- Vendor selection
- Save and reuse filters

### 4. Side-by-Side Comparison
- Compare up to 5 plans
- Automatic comparison matrix generation
- Feature-by-feature breakdown
- Visual indicators (✓, ✗, —)

### 5. Smart Recommendations
- Best value calculation
- Lowest price identification
- Best coverage identification
- Coverage-to-price ratio scoring

## Integration with Other Services

### Lead Service (Port 7071)
- **Subscribes to:** `lead.created` event
- **Publishes:** `plans.fetch_completed` event (consumed by Lead Service)

### Quotation Service (Port 7073)
- **Provides:** Selected plans for quotation generation
- **Publishes:** `plans.selected` event (consumed by Quotation Service)

## Event Flow

```
Lead Service                Quotation Generation Service
     │                              │
     ├──[lead.created]──────────────>│
     │                               ├── Fetch plans from vendors
     │                               ├── Save plans to PlanDB
     │                               ├── Mark recommended plan
     │<─[plans.fetch_completed]──────┤
     │                               │
     │                               │
User selects plans                   │
     │──[POST /plans/select]─────────>│
     │                               ├──[plans.selected]────> Quotation Service
     │<─────[Success]────────────────┤
```

## Troubleshooting

### Cosmos DB Connection Issues
```bash
# Check if emulator is running
curl https://localhost:8081/_explorer/index.html -k

# Verify connection string in local.settings.json
```

### Port Already in Use
```bash
# Change port in package.json start script
"start": "func start --port 7072"
```

### Plans Not Fetching
```bash
# Check if vendors are seeded
curl http://localhost:7072/api/vendors?lineOfBusiness=medical

# Re-run setup if needed
npm run setup
```

## Next Steps

1. **Review API Documentation:** See `API.md` for detailed endpoint specs
2. **Test Integration:** Connect with Lead Service running on port 7071
3. **Add More Plans:** Edit `src/data/staticPlans.ts` to add Motor, General, Marine plans
4. **RPA Integration:** Implement `fetchPlansFromRPA()` in `planFetchingService.ts`

## Support

For issues or questions:
- Check logs in Azure Functions console
- Review Cosmos DB data in Azure portal/emulator
- Verify Event Grid events are being published

## Development Tips

- Use `npm run watch` for auto-rebuild during development
- Check function logs for detailed error messages
- Use Azure Storage Explorer to inspect Cosmos DB data
- Test events with Event Grid Viewer


