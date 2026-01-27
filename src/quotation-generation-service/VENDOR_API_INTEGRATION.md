# Vendor API Integration Guide

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [How It Works](#how-it-works)
- [Adding a New Vendor Adapter](#adding-a-new-vendor-adapter)
- [Configuration](#configuration)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The Vendor API Integration system provides a flexible, extensible architecture for integrating insurance vendor APIs alongside existing RPA (Robotic Process Automation) bots. It uses the **Adapter Pattern** to standardize vendor integrations while allowing vendor-specific customizations.

### Key Features

- **Hybrid Integration**: Supports both API and RPA methods
- **Automatic Fallback**: Falls back to RPA if API fails (configurable)
- **Multiple Members Support**: Handles family/group insurance plans
- **Extensible**: Easy to add new vendors
- **Type-Safe**: Full TypeScript support with interfaces
- **Testable**: Comprehensive unit tests with mocking support

### Current Vendors

| Vendor | Status | Methods | Priority |
|--------|--------|---------|----------|
| Takaful Emarat | ✅ Active | API + RPA | API |
| Alsagr | 🔄 RPA Only | RPA | RPA |
| Sukoon | 🔄 RPA Only | RPA | RPA |
| Watania | ⏸️ Pending | - | - |

---

## Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     fetchPlans.ts                            │
│                   (Orchestration Layer)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┴────────────────┐
         │                                 │
         ▼                                 ▼
┌────────────────────┐          ┌──────────────────┐
│ VendorApiService   │          │  RpaVmService    │
│  (API Vendors)     │          │  (RPA Vendors)   │
└─────────┬──────────┘          └──────────────────┘
          │
          │ Factory Pattern
          │
     ┌────┴─────┐
     │          │
     ▼          ▼
┌──────────┐ ┌──────────┐
│ Takaful  │ │  Sukoon  │
│ Adapter  │ │  Adapter │
└──────────┘ └──────────┘
     │
     │ extends
     ▼
┌──────────────────┐
│ BaseVendorAdapter│
│  (Abstract Class)│
└──────────────────┘
```

### Class Hierarchy

```typescript
BaseVendorAdapter (abstract)
├── TakafulAdapter
├── SukoonAdapter (future)
└── AlsagrAdapter (future)
```

---

## How It Works

### Flow for API-Enabled Vendors

1. **Lead Created** → Triggers plan fetching
2. **Vendor Separation** → Categorizes vendors by integration type:
   - API vendors (`integrationPriority: 'api'` or `'both'`)
   - RPA vendors (`integrationPriority: 'rpa'`)
   - Static vendors (hardcoded plans)
3. **API Execution** → VendorApiService processes API vendors in parallel
4. **Plan Fetching**:
   - Authenticate with vendor API
   - Create quotation
   - Create primary member
   - Create additional members (if family plan)
   - Fetch products for each member
   - Aggregate plans by plan code
   - Sum premiums across members
5. **Fallback Logic** (if `integrationPriority: 'both'`):
   - If API fails → Automatically retry with RPA
6. **Save Plans** → Store plans in Cosmos DB
7. **Publish Event** → Notify other services

### Multi-Step API Workflow (Takaful Example)

```
1. POST /authorize/Authorize
   → Get accessToken

2. POST /Quotation/CreateQuotation
   → Get quotation_no

3. POST /Member/CreatePrimaryMember
   → Get primaryMemberSno

4. POST /Member/CreateMembers (if dependents)
   → Get dependentMemberSnos[]

5. POST /Product/GetAllProducts (for each member)
   → Get products[] per member

6. Aggregate Plans
   → Group by plan code
   → Sum premiums across members

7. Normalize to StandardPlan
   → Return unified plan format
```

---

## Adding a New Vendor Adapter

Follow these steps to integrate a new vendor API.

### Step 1: Create Vendor Adapter Class

Create `src/services/vendorAdapters/yourVendorAdapter.ts`:

```typescript
import { BaseVendorAdapter, VendorApiConfig, VendorApiResult } from './baseVendorAdapter';
import { Plan } from '../../models/plan';

export class YourVendorAdapter extends BaseVendorAdapter {
  constructor(config: VendorApiConfig) {
    super('vendor-yourvendor', 'Your Vendor Name', config);
  }

  /**
   * Main orchestration - implement your API flow
   */
  async fetchPlans(leadData: any): Promise<VendorApiResult> {
    const startTime = Date.now();

    try {
      // Step 1: Authenticate
      await this.authenticate();

      // Step 2: Transform lead data
      const vendorPayload = this.transformLead(leadData);

      // Step 3: Call vendor API(s)
      // ... your vendor-specific API calls ...

      // Step 4: Normalize response
      const plans = this.normalizePlans(vendorResponse, leadData.leadId);

      const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;

      return {
        vendorId: this.vendorId,
        plans,
        success: true,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = `${((Date.now() - startTime) / 1000).toFixed(2)}s`;
      
      return {
        vendorId: this.vendorId,
        plans: [],
        success: false,
        error: this.handleError(error),
        executionTime,
      };
    }
  }

  /**
   * Authenticate with vendor API
   */
  protected async authenticate(): Promise<string> {
    // Implement authentication logic
    // Cache token if needed
    // Return access token
  }

  /**
   * Transform lead data to vendor format
   */
  protected transformLead(leadData: any): any {
    // Map our StandardLead format to vendor-specific format
    return {
      // Vendor-specific field mappings
    };
  }

  /**
   * Normalize vendor response to StandardPlan
   */
  protected normalizePlans(vendorData: any, leadId: string): Plan[] {
    return vendorData.plans.map((vendorPlan: any) => ({
      id: `${leadId}_${this.vendorId}_${vendorPlan.id}`,
      leadId,
      vendorId: this.vendorId,
      vendorName: this.vendorName,
      planName: vendorPlan.name,
      annualPremium: vendorPlan.premium,
      // ... map other fields ...
    } as Plan));
  }

  /**
   * Handle vendor-specific errors
   */
  protected handleError(error: any): string {
    // Return user-friendly error messages
    return error.message || 'Unknown error';
  }
}
```

### Step 2: Register Adapter in Factory

Update `src/services/vendorApiService.ts`:

```typescript
import { YourVendorAdapter } from './vendorAdapters/yourVendorAdapter';

// In initializeAdapter method:
switch (vendor.code.toUpperCase()) {
  // ... existing cases ...
  
  case 'YVN':
  case 'YOURVENDOR':
    adapter = new YourVendorAdapter({
      baseUrl: vendor.apiEndpoint!,
      apiKey: vendor.apiKey!,
      credentials: {
        username: process.env.YOUR_VENDOR_USERNAME!,
        password: process.env.YOUR_VENDOR_PASSWORD!,
      },
      timeout: vendor.apiTimeout || 60000,
    });
    break;
}
```

### Step 3: Export Adapter

Update `src/services/vendorAdapters/index.ts`:

```typescript
export { YourVendorAdapter } from './yourVendorAdapter';
```

### Step 4: Add Vendor Configuration

Add to Cosmos DB `vendors` container:

```json
{
  "id": "vendor-yourvendor",
  "name": "Your Vendor Name",
  "code": "YVN",
  "lineOfBusiness": "Medical",
  "apiEnabled": true,
  "apiEndpoint": "https://api.yourvendor.com",
  "apiKey": "your-api-key",
  "apiAuthType": "bearer",
  "apiTimeout": 60000,
  "integrationPriority": "api",
  "rpaEnabled": false,
  "hasStaticPlans": false,
  "isActive": true,
  "priority": 10
}
```

### Step 5: Add Environment Variables

```bash
YOUR_VENDOR_USERNAME=username
YOUR_VENDOR_PASSWORD=password
YOUR_VENDOR_API_KEY=api-key
```

### Step 6: Write Tests

Create `src/services/vendorAdapters/tests/yourVendorAdapter.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { YourVendorAdapter } from '../yourVendorAdapter';

describe('YourVendorAdapter', () => {
  // ... test authentication
  // ... test plan fetching
  // ... test error handling
  // ... test data transformation
});
```

---

## Configuration

### Environment Variables

Required for each vendor:

```bash
# Takaful
TAKAFUL_USERNAME=<username>
TAKAFUL_PASSWORD=<password>
TAKAFUL_SECRET_KEY=<secret>

# Future vendors
SUKOON_API_KEY=<key>
ALSAGR_USERNAME=<username>
```

### Vendor Document Schema

```typescript
interface Vendor {
  id: string;                    // "vendor-{name}"
  name: string;                  // Display name
  code: string;                  // Short code (for adapter factory)
  lineOfBusiness: string;        // Partition key
  
  // API Integration
  apiEnabled: boolean;           // Enable API
  apiEndpoint?: string;          // Base URL
  apiKey?: string;               // Subscription key
  apiAuthType?: string;          // Auth type
  apiTimeout?: number;           // Timeout (ms)
  
  // RPA Integration
  rpaEnabled: boolean;           // Enable RPA
  rpaEndpoint?: string;          // RPA URL
  
  // Priority
  integrationPriority: 'api' | 'rpa' | 'both';
  
  // Status
  isActive: boolean;
  priority: number;
}
```

### Integration Priority Options

| Value | Behavior |
|-------|----------|
| `api` | Use API only, never RPA |
| `rpa` | Use RPA only, never API |
| `both` | Try API first, fallback to RPA if fails |

---

## Testing

### Unit Tests

Run unit tests:

```bash
cd nectaria-services/src/quotation-generation-service
npm test
```

Run specific test file:

```bash
npm test takafulAdapter.test.ts
```

Run with coverage:

```bash
npm run test:coverage
```

### Integration Tests

Test with real Takaful UAT environment:

```bash
# Set environment variables
export TAKAFUL_USERNAME=your_username
export TAKAFUL_PASSWORD=your_password
export TAKAFUL_SECRET_KEY=your_secret

# Start the service
npm start

# Call the endpoint
curl -X POST http://localhost:7072/api/plans/fetch \
  -H "Content-Type: application/json" \
  -d @test-lead.json
```

### Test Data

Example `test-lead.json`:

```json
{
  "leadId": "test-lead-123",
  "lineOfBusiness": "Medical",
  "businessType": "Individual",
  "leadData": {
    "leadId": "test-lead-123",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": {"number": "0501234567"},
    "emirate": "Dubai",
    "lobData": {
      "dateOfBirth": "1990-01-01",
      "gender": "Male",
      "height": 175,
      "weight": 75,
      "members": [
        {
          "firstName": "Jane",
          "lastName": "Doe",
          "dateOfBirth": "1992-06-15",
          "gender": "Female",
          "relationship": "spouse",
          "height": 165,
          "weight": 60
        }
      ]
    }
  }
}
```

---

## Troubleshooting

### Common Issues

#### 1. "No adapter implemented for vendor: XXX"

**Cause**: Vendor code doesn't match any case in the adapter factory.

**Solution**:
- Check `vendor.code` in Cosmos DB
- Verify switch case in `vendorApiService.ts`
- Ensure adapter is imported

#### 2. "Authentication failed: 401"

**Cause**: Invalid credentials or token expired.

**Solution**:
- Verify environment variables
- Check credentials with vendor
- Ensure IP is whitelisted (if required)
- Clear adapter cache: `vendorApiService.clearAdapterCache()`

#### 3. "Request timeout after 30000ms"

**Cause**: Vendor API is slow or unresponsive.

**Solution**:
- Increase `apiTimeout` in vendor document
- Check network connectivity
- Verify vendor API status

#### 4. "Business logic validation failed: 422"

**Cause**: Lead data doesn't meet vendor requirements.

**Solution**:
- Check required fields in `transformLead` method
- Verify field mappings (gender, emirate, etc.)
- Check date formats (YYYY-MM-DD)
- Review vendor API documentation

#### 5. Plans not aggregating correctly for family

**Cause**: Plan code mismatch or aggregation logic error.

**Solution**:
- Verify `im_prod_sno` or equivalent unique plan identifier
- Check `aggregatePlansByCode` logic
- Review `memberBreakdown` in raw data

### Debug Mode

Enable detailed logging:

```typescript
// In adapter
console.log('[Vendor] API Response:', JSON.stringify(response, null, 2));
```

Check Application Insights:

```kusto
traces
| where message contains "[Takaful]" or message contains "[VendorApiService]"
| where timestamp > ago(1h)
| order by timestamp desc
```

---

## Best Practices

### 1. Error Handling

```typescript
// ✅ Good: Specific error messages
protected handleError(error: any): string {
  if (error.message.includes('401')) {
    return 'Authentication failed - check credentials';
  }
  if (error.message.includes('422')) {
    return 'Validation failed - check lead data format';
  }
  return error.message;
}

// ❌ Bad: Generic error
protected handleError(error: any): string {
  return 'Error occurred';
}
```

### 2. Token Caching

```typescript
// ✅ Good: Cache with expiry
private accessToken: string | null = null;
private tokenExpiry: Date | null = null;

private async ensureAuthenticated(): Promise<void> {
  if (!this.accessToken || this.isTokenExpired()) {
    await this.authenticate();
  }
}

// ❌ Bad: Authenticate every time
async fetchPlans(leadData: any) {
  const token = await this.authenticate(); // Wasteful
}
```

### 3. Data Transformation

```typescript
// ✅ Good: Centralized mapping
private readonly GENDER_MAP = {
  'Male': 1,
  'Female': 2
};

protected transformLead(leadData: any): any {
  return {
    gender: this.GENDER_MAP[leadData.gender] || 1
  };
}

// ❌ Bad: Hardcoded values
protected transformLead(leadData: any): any {
  return {
    gender: leadData.gender === 'Male' ? 1 : 2
  };
}
```

### 4. Testing

```typescript
// ✅ Good: Mock external dependencies
beforeEach(() => {
  global.fetch = vi.fn();
});

// ✅ Good: Test error scenarios
it('should handle authentication failure', async () => {
  (global.fetch as any).mockResolvedValue({
    ok: false,
    status: 401
  });
  
  const result = await adapter.fetchPlans(leadData);
  expect(result.success).toBe(false);
});
```

### 5. Security

```typescript
// ✅ Good: Never log credentials
console.log('[Vendor] Authenticating...');
// NOT: console.log('Password:', password);

// ✅ Good: Use environment variables
credentials: {
  username: process.env.VENDOR_USERNAME!,
  password: process.env.VENDOR_PASSWORD!
}

// ❌ Bad: Hardcoded credentials
credentials: {
  username: 'hardcoded_user',
  password: 'hardcoded_pass'
}
```

### 6. Performance

```typescript
// ✅ Good: Parallel execution for multiple members
const promises = memberSnos.map(sno => 
  this.getProducts(quotationNo, sno, tpa)
);
await Promise.all(promises);

// ❌ Bad: Sequential execution
for (const sno of memberSnos) {
  await this.getProducts(quotationNo, sno, tpa); // Slow
}
```

---

## Migration Checklist

When migrating a vendor from RPA to API:

- [ ] Obtain API credentials from vendor
- [ ] Request IP whitelisting (if required)
- [ ] Create adapter class
- [ ] Implement authentication
- [ ] Implement lead transformation
- [ ] Implement plan fetching
- [ ] Implement plan normalization
- [ ] Add to adapter factory
- [ ] Write unit tests (>80% coverage)
- [ ] Test with UAT environment
- [ ] Update vendor document in Cosmos DB
- [ ] Set `integrationPriority: 'both'` initially
- [ ] Monitor API vs RPA performance
- [ ] Switch to `integrationPriority: 'api'` after validation
- [ ] Disable RPA after stable period
- [ ] Update documentation

---

## Support

For questions or issues:

- **Code Review**: Check existing adapters (TakafulAdapter) as reference
- **API Docs**: See vendor-specific API documentation in `/api-docs`
- **Configuration**: See `TAKAFUL_API_CONFIGURATION.md`
- **Tests**: Review test files in `/tests` directory

---

## Appendix

### Helper Methods Available in BaseVendorAdapter

- `parseNumber(value)` - Extract numbers from strings
- `cleanText(text)` - Normalize whitespace
- `formatDate(date)` - Convert to ISO format
- `calculateAge(dob)` - Get age from date of birth
- `extractPhoneNumber(phone)` - Extract phone from object/string
- `generateUUID()` - Generate unique IDs
- `sleep(ms)` - Delay execution
- `makeRequest(url, options)` - HTTP request with timeout

### Standard Plan Fields

Key fields to map in `normalizePlans`:

- `id` - Unique plan identifier
- `leadId` - Associated lead
- `vendorId` - Vendor identifier
- `vendorName` - Display name
- `planName` - Plan name
- `annualPremium` - Yearly cost
- `coverageAmount` - Coverage limit
- `benefits` - List of benefits
- `network` - TPA/network info

### Useful TypeScript Types

```typescript
import { Plan } from '../models/plan';
import { VendorApiConfig, VendorApiResult } from './baseVendorAdapter';
```

---

*Last Updated: 2026-01-26*
*Version: 1.0.0*
