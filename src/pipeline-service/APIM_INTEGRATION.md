# API Management (APIM) Integration Guide

This document describes how to configure Azure API Management for routing synchronous API calls from the Pipeline Service to other services.

## Overview

The Pipeline Service makes synchronous HTTP calls for immediate operations. Routing these through APIM provides:
- Rate limiting per pipeline instance
- Request/response caching
- Centralized analytics and monitoring
- A/B testing capabilities
- API versioning support

## Configuration

### 1. Update HTTP Client

The HTTP client already supports APIM routing. Set the environment variable:

```bash
APIM_GATEWAY_URL=https://your-apim-instance.azure-api.net
```

If not set, the client falls back to direct service URLs.

### 2. APIM Policy Configuration

Create or update the APIM policy for Pipeline Service → Service calls:

```xml
<policies>
  <inbound>
    <!-- Rate limiting per pipeline instance -->
    <rate-limit-by-key 
      calls="100" 
      renewal-period="60" 
      counter-key="@(context.Request.Headers.GetValueOrDefault("x-instance-id"))" />
    
    <!-- Cache for GET requests -->
    <cache-lookup vary-by-header="x-instance-id" />
    
    <!-- Validate service key -->
    <check-header 
      name="x-service-key" 
      failed-check-httpcode="401" 
      failed-check-error-message="Missing or invalid service key" />
    
    <!-- Add correlation tracking -->
    <set-header name="x-apim-correlation-id" exists-action="skip">
      <value>@(Guid.NewGuid().ToString())</value>
    </set-header>
    
    <!-- Log request -->
    <log-to-eventhub logger-id="pipeline-analytics">
      @{
        return new JObject(
          new JProperty("timestamp", DateTime.UtcNow),
          new JProperty("service", context.Request.Url.Path),
          new JProperty("instanceId", context.Request.Headers.GetValueOrDefault("x-instance-id")),
          new JProperty("method", context.Request.Method)
        ).ToString();
      }
    </log-to-eventhub>
  </inbound>
  
  <backend>
    <!-- Timeout and retry -->
    <retry 
      condition="@(context.Response.StatusCode >= 500)" 
      count="3" 
      interval="2" 
      delta="1" />
  </backend>
  
  <outbound>
    <!-- Cache response -->
    <cache-store duration="60" />
  </outbound>
  
  <on-error>
    <!-- Log errors -->
    <log-to-eventhub logger-id="pipeline-errors">
      @{
        return new JObject(
          new JProperty("timestamp", DateTime.UtcNow),
          new JProperty("error", context.LastError.Message),
          new JProperty("source", context.LastError.Source)
        ).ToString();
      }
    </log-to-eventhub>
  </on-error>
</policies>
```

### 3. Service Backend Configuration

Configure backend services in APIM:

- **Lead Service**: `https://lead-service.azurewebsites.net`
- **Quotation Service**: `https://quotation-service.azurewebsites.net`
- **Quotation Gen Service**: `https://quotation-gen-service.azurewebsites.net`
- **Policy Service**: `https://policy-service.azurewebsites.net`

### 4. API Operations

Create API operations for each service endpoint:

#### Lead Service
- `PUT /api/leads/{leadId}/stage` - Update lead stage

#### Quotation Service
- `POST /api/quotations` - Create quotation
- `PUT /api/quotations/{id}` - Update quotation
- `POST /api/quotations/{id}/approve` - Approve quotation
- `POST /api/quotations/{id}/reject` - Reject quotation

#### Quotation Gen Service
- `GET /api/plans/{planId}` - Get plan details

#### Policy Service
- `POST /api/policy-requests` - Create policy request
- `GET /api/policies/{id}` - Get policy details

## Benefits

### Rate Limiting
Prevents service overload by limiting requests per pipeline instance:
- 100 calls per minute per instance
- Prevents cascading failures

### Caching
Reduces redundant API calls:
- GET requests cached for 60 seconds
- Varies by instance ID for isolation

### Analytics
Centralized monitoring of all sync operations:
- Request/response logging
- Performance metrics
- Error tracking

### Retry Logic
Automatic retry for transient failures:
- 3 retries for 5xx errors
- Exponential backoff

## Testing

1. Set `APIM_GATEWAY_URL` environment variable
2. Make a sync action call from Pipeline Service
3. Verify request is routed through APIM
4. Check APIM analytics for request logs
5. Verify rate limiting works correctly

## Monitoring

- **APIM Analytics**: Request volume, latency, errors
- **Event Hub Logs**: Detailed request/response data
- **Application Insights**: End-to-end correlation

## Fallback Behavior

If APIM is not configured (`APIM_GATEWAY_URL` not set), the HTTP client automatically falls back to direct service URLs. This allows:
- Local development without APIM
- Gradual migration to APIM
- Fallback if APIM is unavailable

