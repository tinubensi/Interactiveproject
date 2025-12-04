# Quotation Service

Azure Functions service for managing insurance quotations from selected plans to final quotation documents.

## Features

- Create quotations from selected plans
- Manage quotation lifecycle (draft, sent, approved, rejected, expired)
- Revision and versioning system
- PDF generation
- Email delivery
- Timeline tracking
- Support for all lines of business
- Event-driven architecture

## Architecture

- **Runtime**: Node.js 20, TypeScript
- **Database**: Azure Cosmos DB (QuotationDB)
- **Storage**: Azure Blob Storage (PDF documents)
- **Events**: Azure Event Grid
- **Pattern**: Serverless Azure Functions

## Containers

- `quotations` (Partition Key: `/leadId`)
- `quotationPlans` (Partition Key: `/quotationId`)
- `revisions` (Partition Key: `/quotationId`)

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Setup database
npm run setup

# Start service (runs on port 7073)
npm start
```

## API Endpoints

### Quotation Management
- `POST /api/quotations` - Create quotation
- `GET /api/quotations/{id}` - Get quotation by ID
- `POST /api/quotations/list` - List quotations with filters
- `PUT /api/quotations/{id}` - Update quotation
- `DELETE /api/quotations/{id}` - Delete quotation
- `POST /api/quotations/{id}/revise` - Create revision
- `PATCH /api/quotations/{id}/status` - Change status
- `POST /api/quotations/{id}/send` - Send to customer
- `POST /api/quotations/{id}/pdf` - Generate PDF

### Revisions
- `GET /api/quotations/{id}/revisions` - Get revision history

## Events

### Published
- `quotation.created`
- `quotation.updated`
- `quotation.revised`
- `quotation.sent`
- `quotation.approved`
- `quotation.rejected`
- `quotation.expired`

### Subscribed
- `plans.selected` (trigger quotation creation)

## Local Development

Service runs on **port 7073**


