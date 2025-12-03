# Form Service API

## Templates

- `GET /api/templates-list?insuranceLine=AUTO&status=completed&search=company`
- `POST /api/templates`
- `POST /api/templates/autosave`
- `GET /api/templates/{templateId}?insuranceLine=AUTO`
- `PUT /api/templates-update/{templateId}?insuranceLine=AUTO`
- `DELETE /api/templates-delete/{templateId}?insuranceLine=AUTO`
- `POST /api/templates/{templateId}/connectors?insuranceLine=AUTO`

### Template payload

```json
{
  "name": "Corporate Client Intake",
  "insuranceLine": "COMMERCIAL",
  "organizationId": "iib",
  "sections": [
    {
      "id": "company",
      "title": "COMPANY",
      "order": 0,
      "questions": [
        {
          "id": "companyName",
          "label": "Company Name",
          "dataKey": "company_name",
          "type": "text",
          "order": 0,
          "validation": { "required": true }
        }
      ]
    }
  ],
  "questionsWithoutSection": [],
  "connectors": [
    {
      "portal": "CarrierA",
      "fieldMap": {
        "company_name": "full_name"
      }
    }
  ]
}
```

## Intakes

- `GET /api/intakes-list?templateId={templateId}&status={status}&insuranceLine={insuranceLine}&search={search}&pageSize={pageSize}&continuationToken={token}`
  - `templateId` (optional): Filter intakes by specific template
  - `status` (optional): Filter by status (`draft` or `completed`)
  - `insuranceLine` (optional): Filter by insurance line (e.g., `COMMERCIAL`, `AUTO`)
  - `search` (optional): Search across intakeId, templateId, and customerId fields
  - `pageSize` (optional): Number of items per page (default: 25)
  - `continuationToken` (optional): Token for pagination
  - Returns: `{ items: FormIntake[], total: number, continuationToken?: string }`
- `POST /api/intakes/autosave`
- `POST /api/intakes`
- `GET /api/intakes/{intakeId}`

### Submit payload

```json
{
  "intakeId": "optional",
  "templateId": "template-id",
  "insuranceLine": "COMMERCIAL",
  "customerId": "cust-123",
  "formDataRaw": {
    "company_name": "Widgets LLC",
    "agent": "Direct",
    "email": "info@example.com"
  }
}
```

## Events

- Consumes `RenewalInitiatedEvent` via Event Grid.
- Publishes `IntakeFormSubmittedEvent` with `{ intakeId, customerId, insuranceLine, formData }`.

