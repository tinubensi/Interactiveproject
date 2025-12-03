# Quotation Generation Service

Azure Functions service for fetching, filtering, and comparing insurance plans across all vendors and lines of business.

## Features

- Plan fetching from multiple vendors (Static for now, RPA integration ready)
- Advanced plan filtering (premium, deductible, coverage, etc.)
- Side-by-side plan comparison (up to 5 plans)
- Plan selection for quotation
- Support for all lines of business
- Event-driven architecture

## Architecture

- **Runtime**: Node.js 20, TypeScript
- **Database**: Azure Cosmos DB (PlanDB)
- **Events**: Azure Event Grid
- **Pattern**: Serverless Azure Functions

## Containers

- `fetchRequests` (Partition Key: `/leadId`)
- `plans` (Partition Key: `/leadId`)
- `planFilters` (Partition Key: `/leadId`)
- `planComparisons` (Partition Key: `/leadId`)
- `vendors` (Partition Key: `/lineOfBusiness`)

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Setup database
npm run setup

# Start service (runs on port 7072)
npm start
```

## API Endpoints

### Plan Fetching
- `POST /api/plans/fetch` - Trigger plan fetch for a lead
- `GET /api/plans/fetch/{id}` - Get fetch request status
- `POST /api/plans/list` - List plans with filters
- `GET /api/plans/{id}` - Get plan by ID

### Plan Filtering
- `POST /api/plans/filters` - Save filter criteria
- `GET /api/plans/filters/{leadId}` - Get saved filters
- `DELETE /api/plans/filters/{leadId}` - Clear filters

### Plan Comparison
- `POST /api/plans/compare` - Create comparison
- `GET /api/plans/compare/{id}` - Get comparison details

### Plan Selection
- `POST /api/plans/select` - Mark plans as selected for quotation

### Vendors
- `GET /api/vendors` - List vendors
- `GET /api/vendors/lob/{lob}` - Get vendors by LOB

## Events

### Published
- `plans.fetch_started`
- `plans.fetch_completed`
- `plans.fetch_failed`
- `plans.filtered`
- `plans.compared`
- `plans.selected`

### Subscribed
- `lead.created` (auto-trigger plan fetch)

## Static Plans

Currently includes 3-5 static plans per LOB:
- Medical (Pet): 3 plans
- Motor: 3 plans (ready)
- General: 3 plans (ready)
- Marine: 3 plans (ready)

## Local Development

Service runs on **port 7072** to avoid conflicts with Lead Service (7071)


