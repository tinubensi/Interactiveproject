# Quotation Generation Service API Documentation

Base URL (Local): `http://localhost:7072/api`

## Table of Contents
- [Plan Fetching](#plan-fetching)
- [Plan Management](#plan-management)
- [Filters](#filters)
- [Comparisons](#comparisons)
- [Vendors](#vendors)
- [Events](#events)

---

## Plan Fetching

### 1. Fetch Plans
Trigger plan fetching from all vendors for a lead

**Endpoint:** `POST /plans/fetch`

**Request:**
```json
{
  "leadId": "lead-abc-123",
  "lineOfBusiness": "medical",
  "businessType": "individual",
  "leadData": {
    "petType": "Dog",
    "petBreed": "Golden Retriever",
    "petBirthday": "2020-01-15",
    "petGender": "male"
  },
  "forceRefresh": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plans fetched successfully",
  "data": {
    "fetchRequestId": "fetch-xyz-456",
    "totalPlans": 3,
    "vendors": ["Al Dhafra Insurance", "Oman Insurance Company"],
    "plans": [...],
    "recommendedPlanId": "plan-lead-abc-123-2"
  }
}
```

---

## Plan Management

### 2. List Plans
List plans with filtering, sorting, and pagination

**Endpoint:** `POST /plans/list`

**Request:**
```json
{
  "leadId": "lead-abc-123",
  "page": 1,
  "limit": 20,
  "sortBy": "annualPremium",
  "sortOrder": "asc",
  "filters": {
    "vendorIds": ["vendor-adip"],
    "isAvailable": true,
    "annualPremium": {
      "min": 1000,
      "max": 3000
    },
    "deductible": {
      "max": 500
    },
    "annualLimit": {
      "min": 50000
    }
  },
  "applyFilterId": "filter-123"
}
```

**Response:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalRecords": 3,
    "totalPages": 1,
    "hasNext": false,
    "hasPrevious": false
  },
  "filters": {
    "applied": {...},
    "available": {
      "vendors": [
        {
          "id": "vendor-adip",
          "name": "Al Dhafra Insurance",
          "count": 1,
          "avgPremium": 1500
        }
      ],
      "priceRanges": {
        "minPremium": 1500,
        "maxPremium": 3500,
        "avgPremium": 2500
      },
      "coverageRanges": {
        "minAnnualLimit": 50000,
        "maxAnnualLimit": 150000,
        "minDeductible": 0,
        "maxDeductible": 500
      }
    }
  },
  "sort": {
    "sortBy": "annualPremium",
    "sortOrder": "asc"
  },
  "aggregations": {
    "totalPlans": 3,
    "availablePlans": 3,
    "selectedPlans": 0,
    "byVendor": [...]
  },
  "recommendations": {
    "bestValue": "plan-123",
    "lowestPrice": "plan-456",
    "bestCoverage": "plan-789"
  }
}
```

**Sortable Fields:**
- `annualPremium`
- `monthlyPremium`
- `deductible`
- `annualLimit`
- `coInsurance`
- `waitingPeriod`

### 3. Get Plan by ID
Retrieve a single plan

**Endpoint:** `GET /plans/{id}?leadId=lead-abc-123`

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "plan-lead-abc-123-1",
      "leadId": "lead-abc-123",
      "vendorId": "vendor-adip",
      "vendorName": "Al Dhafra Insurance",
      "planName": "Pet Care Essential",
      "annualPremium": 1500,
      "monthlyPremium": 130,
      "currency": "AED",
      "annualLimit": 50000,
      "deductible": 500,
      "coInsurance": 20,
      "waitingPeriod": 14,
      "benefits": [...],
      "exclusions": [...],
      "isRecommended": false,
      "isSelected": false
    }
  }
}
```

### 4. Select Plans
Mark plans as selected for quotation

**Endpoint:** `POST /plans/select`

**Request:**
```json
{
  "leadId": "lead-abc-123",
  "planIds": ["plan-1", "plan-2"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Plans selected successfully",
  "data": {
    "selectedPlans": [...],
    "count": 2
  }
}
```

**Notes:**
- Maximum 5 plans can be selected
- Selecting new plans automatically unselects previously selected plans
- Triggers `plans.selected` event

---

## Filters

### 5. Save Filters
Save filter criteria for a lead

**Endpoint:** `POST /plans/filters`

**Request:**
```json
{
  "leadId": "lead-abc-123",
  "annualPremium": {
    "min": 1000,
    "max": 3000
  },
  "monthlyPremium": {
    "min": 100,
    "max": 300
  },
  "annualLimit": {
    "min": 50000,
    "max": 150000
  },
  "deductible": {
    "min": 0,
    "max": 500
  },
  "coInsurance": {
    "min": 0,
    "max": 20
  },
  "waitingPeriod": {
    "max": 14
  },
  "selectedVendors": ["vendor-adip", "vendor-oic"],
  "planTypes": ["basic", "premium"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Filters saved successfully",
  "data": {
    "filter": {...},
    "matchingPlansCount": 2
  }
}
```

### 6. Get Filters
Retrieve saved filters for a lead

**Endpoint:** `GET /plans/filters/{leadId}`

**Response:**
```json
{
  "success": true,
  "data": {
    "filter": {
      "id": "filter-123",
      "leadId": "lead-abc-123",
      "annualPremium": {...},
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

---

## Comparisons

### 7. Create Comparison
Create a side-by-side comparison of plans

**Endpoint:** `POST /plans/compare`

**Request:**
```json
{
  "leadId": "lead-abc-123",
  "planIds": ["plan-1", "plan-2", "plan-3"]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Comparison created successfully",
  "data": {
    "comparison": {
      "id": "comp-123",
      "leadId": "lead-abc-123",
      "planIds": ["plan-1", "plan-2", "plan-3"],
      "comparisonMatrix": [
        {
          "feature": "Annual Premium",
          "category": "Pricing",
          "plans": {
            "plan-1": "1500 AED",
            "plan-2": "2500 AED",
            "plan-3": "3500 AED"
          }
        },
        {
          "feature": "Deductible",
          "category": "Coverage",
          "plans": {
            "plan-1": "500 AED",
            "plan-2": "250 AED",
            "plan-3": "0 AED"
          }
        },
        {
          "feature": "Accident Treatment",
          "category": "Medical Coverage",
          "plans": {
            "plan-1": "✓ (50000 AED)",
            "plan-2": "✓ (100000 AED)",
            "plan-3": "✓ (150000 AED)"
          }
        }
      ],
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "plans": [...]
  }
}
```

**Notes:**
- Minimum 2 plans, maximum 5 plans
- Automatically generates comparison matrix for all features
- Benefits are marked with ✓ (covered), ✗ (not covered), or — (not applicable)

### 8. Get Comparison
Retrieve comparison for a lead

**Endpoint:** `GET /plans/compare?leadId=lead-abc-123`

**Response:**
```json
{
  "success": true,
  "data": {
    "comparison": {...},
    "plans": [...]
  }
}
```

---

## Vendors

### 9. Get Vendors
List all vendors or filter by LOB

**Endpoint:** `GET /vendors?lineOfBusiness=medical`

**Response:**
```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "id": "vendor-adip",
        "name": "Al Dhafra Insurance",
        "code": "ADIP",
        "lineOfBusiness": "medical",
        "logo": "https://...",
        "website": "https://...",
        "isActive": true,
        "priority": 1
      }
    ]
  }
}
```

**Query Parameters:**
- `lineOfBusiness` (optional): Filter by LOB (medical, motor, general, marine)

---

## Events

### Published Events

#### `plans.fetch_started`
```json
{
  "eventType": "plans.fetch_started",
  "data": {
    "leadId": "lead-abc-123",
    "fetchRequestId": "fetch-xyz-456",
    "lineOfBusiness": "medical",
    "vendorCount": 3,
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

#### `plans.fetch_completed`
```json
{
  "eventType": "plans.fetch_completed",
  "data": {
    "leadId": "lead-abc-123",
    "fetchRequestId": "fetch-xyz-456",
    "totalPlans": 3,
    "successfulVendors": ["Al Dhafra Insurance"],
    "failedVendors": [],
    "timestamp": "2024-01-15T10:00:30Z"
  }
}
```

#### `plans.selected`
```json
{
  "eventType": "plans.selected",
  "data": {
    "leadId": "lead-abc-123",
    "planIds": ["plan-1", "plan-2"],
    "selectedBy": "user-123",
    "timestamp": "2024-01-15T10:05:00Z"
  }
}
```

### Subscribed Events

#### `lead.created`
Auto-triggers plan fetching when a new lead is created

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Detailed error information"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (validation error)
- `404` - Not Found
- `500` - Internal Server Error


