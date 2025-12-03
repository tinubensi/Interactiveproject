# Lead Service API Documentation

## Base URL
```
Local: http://localhost:7071/api
Production: https://<function-app>.azurewebsites.net/api
```

## Endpoints

### Leads

#### Create Lead
```http
POST /leads
```

**Request Body:**
```json
{
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
    "breedType": "Large",
    "isPureBreed": true,
    "isMicrochipped": true,
    "microchipId": "123456789",
    "isNeutered": true,
    "hasHealthIssues": false,
    "weightInKg": 30
  },
  "source": "Website"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Lead created successfully",
  "data": {
    "lead": {
      "id": "uuid",
      "referenceId": "LEAD-2024-0001",
      "lineOfBusiness": "medical",
      "businessType": "individual",
      "customerId": "customer-123",
      "firstName": "ahmed",
      "lastName": "ali",
      "fullName": "ahmed ali",
      "email": "ahmed.ali@example.com",
      "phone": {
        "number": "+971501234567",
        "countryCode": "+971",
        "isoCode": "AE"
      },
      "emirate": "Dubai",
      "lobData": { ... },
      "currentStage": "New Lead",
      "stageId": 1,
      "isHotLead": false,
      "isEmailRepeated": false,
      "isPhoneRepeated": false,
      "createdAt": "2024-11-28T10:00:00Z",
      "updatedAt": "2024-11-28T10:00:00Z"
    },
    "warnings": {
      "isEmailRepeated": false,
      "isPhoneRepeated": false
    }
  }
}
```

#### List Leads
```http
POST /leads/list
```

**Request Body:**
```json
{
  "page": 1,
  "limit": 20,
  "sortBy": "createdAt",
  "sortOrder": "desc",
  "search": "ahmed",
  "filters": {
    "lineOfBusiness": ["medical"],
    "stageId": [1, 2, 3],
    "assignedTo": ["agent-456"],
    "createdFrom": "2024-11-01T00:00:00Z",
    "createdTo": "2024-11-30T23:59:59Z",
    "isHotLead": false
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 156,
    "totalPages": 8,
    "hasNext": true,
    "hasPrevious": false
  },
  "filters": {
    "applied": { ... },
    "available": { ... }
  },
  "sort": {
    "sortBy": "createdAt",
    "sortOrder": "desc"
  }
}
```

#### Get Lead by ID
```http
GET /leads/{id}?lineOfBusiness={lob}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "lead": { ... },
    "timeline": [ ... ]
  }
}
```

#### Update Lead
```http
PUT /leads/{id}?lineOfBusiness={lob}
```

**Request Body:**
```json
{
  "firstName": "Ahmed",
  "lastName": "Ali",
  "email": "new.email@example.com",
  "assignedTo": "agent-789",
  "isHotLead": true,
  "lobData": {
    "weightInKg": 32
  }
}
```

#### Delete Lead
```http
DELETE /leads/{id}?lineOfBusiness={lob}
```

#### Change Lead Stage
```http
PATCH /leads/{id}/stage?lineOfBusiness={lob}
```

**Request Body:**
```json
{
  "stageId": 2,
  "remark": "Plans are ready for review",
  "changedBy": "agent-456"
}
```

### Timeline

#### Get Timeline
```http
GET /leads/{id}/timeline
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "leadId": "uuid",
    "timeline": [
      {
        "id": "uuid",
        "leadId": "uuid",
        "stage": "New Lead",
        "stageId": 1,
        "remark": "Lead created",
        "changedBy": "agent-456",
        "changedByName": "Agent Name",
        "timestamp": "2024-11-28T10:00:00Z"
      }
    ]
  }
}
```

### Stages

#### Get Stages
```http
GET /stages
```

**Query Parameters:**
- `lineOfBusiness` (optional): Filter stages by LOB

**Response (200):**
```json
{
  "success": true,
  "data": {
    "stages": [
      {
        "id": 1,
        "name": "New Lead",
        "order": 1,
        "applicableFor": ["medical", "motor", "general", "marine"],
        "isActive": true
      },
      ...
    ]
  }
}
```

### Metadata

#### Get Pet Types
```http
GET /metadata/pet-types
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "petTypes": [
      {
        "id": "pet-type-1",
        "name": "Dog",
        "code": "dog",
        "icon": "🐕",
        "isActive": true
      },
      {
        "id": "pet-type-2",
        "name": "Cat",
        "code": "cat",
        "icon": "🐈",
        "isActive": true
      }
    ]
  }
}
```

#### Get Breeds
```http
POST /metadata/breeds
```

**Request Body:**
```json
{
  "petTypeId": "pet-type-1",
  "breedTypeId": "breed-type-3",
  "search": "retriever"
}
```

#### Get Breed Types
```http
POST /metadata/breed-types
```

**Request Body:**
```json
{
  "petTypeId": "pet-type-1"
}
```

#### Get Gender Types
```http
GET /metadata/gender-types
```

#### Get Emirates
```http
GET /metadata/emirates
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "emirates": [
      {
        "id": "emirate-1",
        "name": "Abu Dhabi",
        "code": "AUH",
        "isActive": true
      },
      ...
    ]
  }
}
```

## Events

### Published Events

#### lead.created
```json
{
  "eventType": "lead.created",
  "subject": "leads/{leadId}",
  "data": {
    "leadId": "uuid",
    "referenceId": "LEAD-2024-0001",
    "customerId": "customer-123",
    "lineOfBusiness": "medical",
    "businessType": "individual",
    "lobData": { ... },
    "createdAt": "2024-11-28T10:00:00Z"
  }
}
```

#### lead.updated
```json
{
  "eventType": "lead.updated",
  "subject": "leads/{leadId}",
  "data": {
    "leadId": "uuid",
    "referenceId": "LEAD-2024-0001",
    "customerId": "customer-123",
    "changes": [
      {
        "field": "firstName",
        "oldValue": "ahmed",
        "newValue": "Ahmad"
      }
    ],
    "updatedBy": "user-123",
    "updatedAt": "2024-11-28T10:30:00Z"
  }
}
```

#### lead.stage_changed
```json
{
  "eventType": "lead.stage_changed",
  "subject": "leads/{leadId}",
  "data": {
    "leadId": "uuid",
    "referenceId": "LEAD-2024-0001",
    "customerId": "customer-123",
    "oldStage": "New Lead",
    "oldStageId": 1,
    "newStage": "Plans Available",
    "newStageId": 2,
    "remark": "10 plans fetched from 3 vendors",
    "timestamp": "2024-11-28T10:05:00Z"
  }
}
```

#### lead.assigned
#### lead.deleted
#### lead.hot_lead_marked

### Subscribed Events

#### plans.fetch_completed
Received from Quotation Generation Service

#### quotation.created
Received from Quotation Service

#### policy.issued
Received from Policy Service

## Error Responses

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

### Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `404` - Not Found
- `410` - Gone (Soft Deleted)
- `500` - Internal Server Error


