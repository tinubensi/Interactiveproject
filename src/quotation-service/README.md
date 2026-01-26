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

## Filtering

### List Quotations Filters

The `/api/quotations/list` endpoint supports comprehensive filtering:

```json
{
  "page": 1,
  "limit": 20,
  "sortBy": "createdAt",
  "sortOrder": "desc",
  "filters": {
    "status": ["draft", "pending", "sent", "rejected"],
    "lineOfBusiness": ["medical", "motor"],
    "isCurrentVersion": true
  }
}
```

**Filter Parameters:**
- `status`: Array of quotation statuses
  - Available: draft, pending, sent, viewed, revision_requested, approved, rejected, expired, superseded, pending_approval, policy_issued
  - **Default Listing**: draft, pending, sent, viewed, revision_requested, rejected, superseded
  - **Excluded from default**: pending_approval (has dedicated page), policy_issued (has dedicated page), approved, expired
- `lineOfBusiness`: Array of LOB values (medical, motor, general, marine)
- `isCurrentVersion`: Boolean to filter current/superseded versions

**Status Lifecycle:**
1. `draft` → Initial creation
2. `pending` → Awaiting review
3. `sent` → Sent to customer
4. `viewed` → Customer viewed quotation
5. `pending_approval` → Customer selected plan (dedicated page)
6. `revision_requested` → Customer requested changes
7. `approved` → Internally approved
8. `policy_issued` → Policy issued (dedicated page)
9. `rejected` → Rejected by customer/internal
10. `expired` → Validity period expired
11. `superseded` → Replaced by newer revision

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


