# Takaful API Configuration Guide

## Environment Variables

Add the following environment variables to your Azure Function App Configuration or local `.env` file:

### Required for Takaful API

```bash
# Takaful API Credentials (obtain from Takaful admin)
TAKAFUL_USERNAME=your_username_here
TAKAFUL_PASSWORD=your_password_here
TAKAFUL_SECRET_KEY=your_secret_key_here
```

### Setting in Azure Function App

1. Navigate to your Function App in Azure Portal
2. Go to **Configuration** > **Application settings**
3. Click **+ New application setting**
4. Add each variable with its value
5. Click **Save** and **Restart** the function app

### Setting for Local Development

Create or update `local.settings.json` in the quotation-generation-service directory:

```json
{
  "IsEncrypted": false,
  "Values": {
    "AzureWebJobsStorage": "UseDevelopmentStorage=true",
    "FUNCTIONS_WORKER_RUNTIME": "node",
    "TAKAFUL_USERNAME": "your_username_here",
    "TAKAFUL_PASSWORD": "your_password_here",
    "TAKAFUL_SECRET_KEY": "your_secret_key_here"
  }
}
```

## Cosmos DB Vendor Configuration

### Create or Update Takaful Vendor Document

Add this document to the `vendors` container in your Cosmos DB:

```json
{
  "id": "vendor-takaful",
  "name": "Takaful Emarat",
  "code": "TKF",
  "lineOfBusiness": "Medical",
  "logo": "https://www.takafulemarat.com/logo.png",
  "website": "https://www.takafulemarat.com",
  
  "rpaEnabled": true,
  "rpaEndpoint": "http://your-rpa-vm-ip:80/api/takaful/scrape",
  
  "apiEnabled": true,
  "apiEndpoint": "https://te-medical-api-uat.takafulemarat.com",
  "apiKey": "your-subscription-key-from-developer-portal",
  "apiAuthType": "bearer",
  "apiTimeout": 60000,
  
  "integrationPriority": "api",
  
  "hasStaticPlans": false,
  "isActive": true,
  "priority": 2,
  
  "createdAt": "2026-01-26T10:00:00.000Z",
  "updatedAt": "2026-01-26T10:00:00.000Z"
}
```

### Field Descriptions

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Unique vendor identifier (format: `vendor-{name}`) |
| `name` | string | Yes | Display name |
| `code` | string | Yes | Short code (used in adapter factory) |
| `lineOfBusiness` | string | Yes | Partition key (Medical, Motor, etc.) |
| `rpaEnabled` | boolean | Yes | Whether RPA integration is available |
| `rpaEndpoint` | string | Conditional | RPA endpoint URL (if rpaEnabled=true) |
| `apiEnabled` | boolean | Yes | Whether API integration is available |
| `apiEndpoint` | string | Conditional | API base URL (if apiEnabled=true) |
| `apiKey` | string | Conditional | API subscription key (if apiEnabled=true) |
| `apiAuthType` | string | No | Authentication type (bearer, apiKey, etc.) |
| `apiTimeout` | number | No | Request timeout in milliseconds (default: 60000) |
| `integrationPriority` | string | Yes | Which method to use: "api", "rpa", or "both" |
| `hasStaticPlans` | boolean | Yes | Whether static plans are available |
| `isActive` | boolean | Yes | Whether vendor is active |
| `priority` | number | Yes | Display order |

### Integration Priority Values

- **`api`**: Use API only. RPA is not attempted even if enabled.
- **`rpa`**: Use RPA only. API is not attempted even if enabled.
- **`both`**: Try API first, fallback to RPA if API fails.

## IP Whitelisting

Takaful requires IP whitelisting for API access.

### Steps:

1. Get your Azure Function App's outbound IP addresses:
   ```bash
   az functionapp show --resource-group <resource-group> --name <function-app-name> --query outboundIpAddresses -o tsv
   ```

2. Email the IP addresses to: **brokerApis@takafulemarat.com**

3. Wait for confirmation from Takaful admin

4. Test API access after whitelisting is confirmed

## Developer Portal Access

### Setup Steps:

1. Visit: https://te-external-apis-dev-portal.takafulemarat.com/

2. Sign up using your work email

3. Navigate to **Subscription** tab

4. Subscribe to the **"Unlimited"** product

5. Wait for Takaful admin approval (may take 1-2 business days)

6. Once approved, navigate to **Profile** > **Subscriptions**

7. Copy the **Primary key** - this is your `apiKey`

8. Add the key to your Function App configuration as `TAKAFUL_API_KEY` in the vendor document

## Testing API Integration

### Test Authentication:

```bash
curl -X POST https://te-medical-api-uat.takafulemarat.com/v1/authorize/Authorize \
  -H "Content-Type: application/json" \
  -H "Ocp-Apim-Subscription-Key: your-subscription-key" \
  -d '{
    "username": "your_username",
    "password": "your_password",
    "secretKey": "your_secret_key"
  }'
```

Expected response:
```json
{
  "message": "The request has succeeded.",
  "data": {
    "partnerId": 123,
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Test Plan Fetching (from Quotation Gen Service):

```bash
curl -X POST http://localhost:7072/api/plans/fetch \
  -H "Content-Type: application/json" \
  -d '{
    "leadId": "test-lead-123",
    "lineOfBusiness": "Medical",
    "businessType": "Individual",
    "leadData": {
      "leadId": "test-lead-123",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john.doe@example.com",
      "phone": {"number": "0501234567"},
      "emirate": "Dubai",
      "lobData": {
        "dateOfBirth": "1990-01-01",
        "gender": "Male",
        "height": 175,
        "weight": 75
      }
    }
  }'
```

## Troubleshooting

### Error: "Authentication failed: 401"

- Check credentials in environment variables
- Verify credentials with Takaful admin
- Ensure IP is whitelisted

### Error: "Request timeout"

- Increase `apiTimeout` in vendor document
- Check network connectivity to Takaful API
- Verify no firewall blocking outbound HTTPS

### Error: "No adapter implemented for vendor: TKF"

- Check that `code` field in vendor document matches the adapter factory switch case
- Verify vendorApiService is properly initialized

### Error: "Business logic validation failed: 422"

- Check lead data format matches Takaful requirements
- Verify all required fields are present
- Check date formats (YYYY-MM-DD)
- Verify emirate/gender/salary mappings

## Security Best Practices

1. **Never commit credentials** to source control
2. **Use Azure Key Vault** for production credentials
3. **Rotate credentials** regularly (every 90 days)
4. **Use different credentials** for UAT and Production
5. **Monitor API usage** to detect anomalies
6. **Log authentication attempts** for audit trail

## Monitoring

### Key Metrics to Track:

- API success rate (target: >95%)
- Average response time (target: <15s for single member, <30s for family)
- Fallback frequency (API → RPA)
- Plan count per vendor
- Error distribution by type

### Application Insights Queries:

```kusto
// API Success Rate
traces
| where message contains "[Takaful]"
| where timestamp > ago(24h)
| summarize 
    Total = count(),
    Successful = countif(message contains "API returned"),
    Failed = countif(message contains "API failed")
| extend SuccessRate = (Successful * 100.0) / Total

// Average Execution Time
traces
| where message contains "[Takaful]" and message contains "execution complete"
| extend executionTime = extract(@"(\d+\.?\d*)s", 1, message)
| summarize avg(todouble(executionTime))
```

## Migration from RPA to API

### Phase 1: Parallel Operation
```json
{
  "apiEnabled": true,
  "rpaEnabled": true,
  "integrationPriority": "both"
}
```

Monitor both methods, compare quality and performance.

### Phase 2: API Primary
```json
{
  "apiEnabled": true,
  "rpaEnabled": true,
  "integrationPriority": "api"
}
```

Use API only, keep RPA as emergency backup.

### Phase 3: API Only
```json
{
  "apiEnabled": true,
  "rpaEnabled": false,
  "integrationPriority": "api"
}
```

Disable RPA completely after API proves stable.
