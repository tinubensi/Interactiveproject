# Lead Service

Azure Functions service for managing insurance leads across all lines of business.

## Features

- Lead CRUD operations with timeline tracking
- Support for multiple lines of business (Medical/Pet, Motor, General, Marine)
- Individual and Group business types
- Advanced search, filtering, and pagination
- Stage management and workflow tracking
- Event-driven architecture with Event Grid
- Reference from Petli legacy system

## Architecture

- **Runtime**: Node.js 20, TypeScript
- **Database**: Azure Cosmos DB (LeadDB)
- **Events**: Azure Event Grid
- **Pattern**: Serverless Azure Functions

## Containers

- `leads` (Partition Key: `/lineOfBusiness`)
- `timelines` (Partition Key: `/leadId`)
- `stages` (Partition Key: `/id`)

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Start locally
npm start
```

## API Endpoints

### Leads
- `POST /api/leads` - Create lead
- `POST /api/leads/list` - List leads (paginated, filtered)
- `GET /api/leads/{id}` - Get lead by ID
- `PUT /api/leads/{id}` - Update lead
- `DELETE /api/leads/{id}` - Delete lead
- `PATCH /api/leads/{id}/stage` - Change lead stage

### Timeline
- `GET /api/leads/{id}/timeline` - Get lead timeline

### Stages
- `GET /api/stages` - Get all stages
- `GET /api/stages/lob/{lob}` - Get stages for line of business

### Metadata
- `GET /api/metadata/pet-types` - Get pet types
- `POST /api/metadata/breeds` - Get breeds (filtered by pet type)
- `POST /api/metadata/breed-types` - Get breed types
- `GET /api/metadata/gender-types` - Get gender types
- `GET /api/metadata/emirates` - Get emirates

## Events

### Published
- `lead.created`
- `lead.updated`
- `lead.stage_changed`
- `lead.deleted`

### Subscribed
- `plans.fetch_completed`
- `quotation.created`
- `policy.issued`

## Local Development

1. Start Cosmos DB Emulator
2. Start Azurite
3. Run `npm start`


