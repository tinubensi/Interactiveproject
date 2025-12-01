# Policy Service

Azure Functions service for managing insurance policy issuance requests and lifecycle.

## Features

- Create policy issuance requests
- Approval/rejection workflow
- Document management (customer, pet, policy documents)
- Policy lifecycle tracking
- Email notifications
- Support for all lines of business
- Event-driven architecture

## Architecture

- **Runtime**: Node.js 20, TypeScript
- **Database**: Azure Cosmos DB (PolicyDB)
- **Storage**: Azure Blob Storage (Policy documents)
- **Events**: Azure Event Grid
- **Pattern**: Serverless Azure Functions

## Containers

- `policyRequests` (Partition Key: `/quotationId`)
- `policies` (Partition Key: `/customerId`)
- `policyDocuments` (Partition Key: `/policyId`)

## Getting Started

```bash
# Install dependencies
npm install

# Build
npm run build

# Setup database
npm run setup

# Start service (runs on port 7074)
npm start
```

## API Endpoints

### Policy Requests
- `POST /api/policy-requests` - Create policy issuance request
- `GET /api/policy-requests/{id}` - Get request by ID
- `POST /api/policy-requests/list` - List requests with filters
- `PATCH /api/policy-requests/{id}/status` - Approve/reject request
- `POST /api/policy-requests/{id}/documents` - Upload documents

### Policies
- `GET /api/policies/{id}` - Get policy by ID
- `POST /api/policies/list` - List policies with filters

## Events

### Published
- `policy.request_created`
- `policy.request_approved`
- `policy.request_rejected`
- `policy.issued`
- `policy.renewed`
- `policy.cancelled`

### Subscribed
- `quotation.approved` (trigger policy request creation)

## Local Development

Service runs on **port 7074**


