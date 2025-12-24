# Security Fixes and Infrastructure Improvements

## Overview
Three issues have been identified and fixed in the Bicep infrastructure templates - two critical security vulnerabilities and one infrastructure flexibility limitation.

---

## Bug 1: Event Grid Topic Key Exposed in Plaintext ✅ FIXED

### Issue
The `EVENT_GRID_TOPIC_KEY` was being passed as a plaintext parameter to function apps, exposing the sensitive Event Grid primary key in application settings. This was inconsistent with how other secrets (like `COSMOS_KEY` and `JWT_SECRET`) were being securely stored in Key Vault.

### Security Impact
- **Severity:** HIGH
- **Risk:** Exposed Event Grid topic key in function app configuration
- **Exposure:** Visible to anyone with read access to function app settings

### Fix Applied

#### Before (Vulnerable):
```bicep
// In function-app.bicep
param eventGridTopicKey string  // Passed as plain parameter

appSettings: [
  {
    name: 'EVENT_GRID_TOPIC_KEY'
    value: eventGridTopicKey  // ❌ Plaintext in app settings
  }
]
```

#### After (Secure):
```bicep
// In function-app.bicep
// Event Grid key now retrieved from Key Vault

appSettings: [
  {
    name: 'EVENT_GRID_TOPIC_KEY'
    value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/event-grid-topic-key/)'  // ✅ Key Vault reference
  }
]
```

### Changes Made:
1. **function-app.bicep**: 
   - Removed `eventGridTopicKey` parameter
   - Changed to Key Vault reference: `@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/event-grid-topic-key/)`

2. **main.bicep**:
   - Removed `eventGridTopicKey` parameter pass to function apps

3. **post-deployment.sh**:
   - Added step 2/5 to retrieve Event Grid topic key
   - Store it in Key Vault as `event-grid-topic-key`

4. **azure-pipelines-infra.yml**:
   - Added Event Grid key retrieval in ConfigureSecrets stage
   - Store in Key Vault before function app deployment

### Verification:
```bash
# Verify Key Vault reference is used
az functionapp config appsettings list \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev \
  --query "[?name=='EVENT_GRID_TOPIC_KEY']"

# Should show: @Microsoft.KeyVault(SecretUri=...)
```

---

## Bug 2: TLS Certificate Validation Disabled ✅ FIXED

### Issue
The `NODE_TLS_REJECT_UNAUTHORIZED` environment variable was set to `'0'`, which **completely disables TLS certificate validation** for all HTTPS connections made by the Node.js process.

### Security Impact
- **Severity:** CRITICAL
- **Risk:** Man-in-the-middle (MITM) attacks
- **Exposure:** All HTTPS connections vulnerable to interception
- **Attack Vector:** Attacker can intercept and modify all HTTPS traffic without detection

### Why This is Dangerous
When `NODE_TLS_REJECT_UNAUTHORIZED=0`:
- Node.js accepts **any** TLS certificate, including self-signed or expired ones
- No validation of certificate chain
- No hostname verification
- **All HTTPS becomes as insecure as HTTP**

This setting should **NEVER** be used in any environment (dev, staging, or production).

### Fix Applied

#### Before (Vulnerable):
```bicep
appSettings: [
  {
    name: 'NODE_TLS_REJECT_UNAUTHORIZED'
    value: '0'  // ❌ CRITICAL VULNERABILITY
  }
]
```

#### After (Secure):
```bicep
// Setting completely removed ✅
// Node.js will use default secure TLS validation
```

### Changes Made:
1. **function-app.bicep**:
   - Completely removed `NODE_TLS_REJECT_UNAUTHORIZED` setting
   - Node.js will now use default secure behavior

### Proper Solutions for Certificate Issues:
If certificate issues arise, the correct solutions are:

1. **Use proper certificates:**
   ```bash
   # For Azure services, certificates are managed automatically
   # No action needed
   ```

2. **For custom domains:**
   ```bash
   # Use Azure App Service Managed Certificates (free)
   # Or upload your own valid certificate
   ```

3. **For local development:**
   ```javascript
   // Use a proper local certificate or accept in code only for localhost
   if (process.env.NODE_ENV === 'development' && url.includes('localhost')) {
     // Handle localhost-specific case
   }
   ```

4. **Never disable globally:** ❌ Don't use `NODE_TLS_REJECT_UNAUTHORIZED=0`

### Verification:
```bash
# Verify setting is removed
az functionapp config appsettings list \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev \
  --query "[?name=='NODE_TLS_REJECT_UNAUTHORIZED']"

# Should return empty array: []
```

---

## Summary of Secrets Management

After these fixes, all secrets are now properly managed:

### Secrets Stored in Key Vault:
| Secret Name | Source | Security Level |
|-------------|--------|----------------|
| `cosmos-key` | Retrieved from Cosmos DB | ✅ Secure |
| `event-grid-topic-key` | Retrieved from Event Grid | ✅ Secure (FIXED) |
| `internal-service-key` | Generated (32-byte random) | ✅ Secure |
| `jwt-secret` | Generated (32-byte random) | ✅ Secure |
| `azure-ad-client-secret` | Manual input | ✅ Secure |

### Function App Settings Pattern:
```bicep
{
  name: 'SECRET_NAME'
  value: '@Microsoft.KeyVault(SecretUri=${keyVaultUri}secrets/secret-name/)'
}
```

### Benefits:
- ✅ **Centralized secret management** in Key Vault
- ✅ **No secrets in plaintext** in function app settings
- ✅ **Audit trail** of secret access via Key Vault logs
- ✅ **Automatic rotation** support (when configured)
- ✅ **RBAC-based access control** via managed identities
- ✅ **Secure TLS connections** with proper certificate validation

---

## Testing the Fixes

### 1. Deploy Infrastructure
```bash
./infra/scripts/deploy-infra.sh dev
./infra/scripts/post-deployment.sh dev
```

### 2. Verify Event Grid Key in Key Vault
```bash
az keyvault secret show \
  --vault-name kv-nectaria-dev \
  --name event-grid-topic-key \
  --query value -o tsv
```

### 3. Verify Function App Settings
```bash
# Check that Event Grid key uses Key Vault reference
az functionapp config appsettings list \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev \
  --query "[?name=='EVENT_GRID_TOPIC_KEY'].value" -o tsv

# Should output: @Microsoft.KeyVault(SecretUri=...)

# Verify NODE_TLS_REJECT_UNAUTHORIZED is removed
az functionapp config appsettings list \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev \
  --query "[?name=='NODE_TLS_REJECT_UNAUTHORIZED']"

# Should output: []
```

### 4. Test HTTPS Connections
```bash
# Functions should now properly validate TLS certificates
# Test a service-to-service call
curl https://func-nectaria-lead-dev.azurewebsites.net/api/health

# Should work with proper TLS validation
```

---

## Compliance Notes

These fixes ensure compliance with:
- ✅ **OWASP Top 10** - A02:2021 Cryptographic Failures
- ✅ **CIS Azure Foundations Benchmark** - Secret Management
- ✅ **NIST Cybersecurity Framework** - Protect (PR.DS-1)
- ✅ **PCI DSS** - Requirement 8 (Key Management)
- ✅ **ISO 27001** - A.10.1.2 (Key Management)

---

## References

- [Azure Key Vault Best Practices](https://docs.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [Node.js TLS/SSL Security](https://nodejs.org/api/tls.html)
- [OWASP - Cryptographic Failures](https://owasp.org/Top10/A02_2021-Cryptographic_Failures/)

---

## Bug 3: Hardcoded Azure Location - **FIXED**

### Issue
The deployment location was hardcoded to `'uaenorth'` in both the deployment script and Azure DevOps pipeline, ignoring the configurable `location` parameter from the parameters file. This prevented deployments to other Azure regions and reduced infrastructure flexibility.

### Impact
- **Severity:** MEDIUM
- **Risk:** Cannot deploy to other regions (e.g., westeurope, eastus, etc.)
- **Limitation:** Multi-region deployments impossible
- **Flexibility:** Ignores user configuration in parameters file

### Fix Applied

#### Before (Inflexible):
```bash
# deploy-infra.sh
az deployment sub validate \
    --location uaenorth \  # ❌ Hardcoded
    --template-file "$INFRA_DIR/main.bicep" \
    --parameters "@$PARAM_FILE"

az deployment sub create \
    --location uaenorth \  # ❌ Hardcoded
    --template-file "$INFRA_DIR/main.bicep"
```

```yaml
# azure-pipelines-infra.yml
variables:
  - name: location
    value: 'uaenorth'  # ❌ Hardcoded

az deployment sub validate \
  --location $(location) \  # Using hardcoded variable
```

#### After (Flexible):
```bash
# deploy-infra.sh
# Extract location from parameters file
LOCATION=$(jq -r '.parameters.location.value' "$PARAM_FILE")
if [ -z "$LOCATION" ] || [ "$LOCATION" = "null" ]; then
    LOCATION="uaenorth"  # ✅ Only fallback default
    echo "⚠️  No location found, using default: $LOCATION"
else
    echo "📍 Deployment location: $LOCATION"
fi

az deployment sub validate \
    --location "$LOCATION" \  # ✅ From parameters
    --template-file "$INFRA_DIR/main.bicep"

az deployment sub create \
    --location "$LOCATION" \  # ✅ From parameters
    --template-file "$INFRA_DIR/main.bicep"
```

```yaml
# azure-pipelines-infra.yml
# Extract location from parameters file
PARAMS_FILE="$INFRA_DIR/parameters.$(environment).json"
LOCATION=$(jq -r '.parameters.location.value' "$PARAMS_FILE")
if [ -z "$LOCATION" ] || [ "$LOCATION" = "null" ]; then
  LOCATION="uaenorth"  # ✅ Only fallback default
fi

az deployment sub validate \
  --location "$LOCATION" \  # ✅ From parameters
```

### Changes Made:
1. **deploy-infra.sh**:
   - Extract location from parameters file using `jq`
   - Use extracted location in both validation and deployment
   - Provide fallback to `uaenorth` if not specified
   - Display deployment location in output

2. **azure-pipelines-infra.yml**:
   - Removed hardcoded `location` variable
   - Extract location from parameters file in deployment stage
   - Use extracted location for all Azure CLI commands
   - Added fallback to `uaenorth` if not found

### Benefits:
- ✅ **Multi-region deployments** now possible
- ✅ **Configuration-driven** location selection
- ✅ **Respects user preferences** from parameters file
- ✅ **Flexible for staging/production** in different regions
- ✅ **Disaster recovery** support (different region deployments)

### Example Use Cases:

**Deploy to West Europe:**
```json
// parameters.westeurope.json
{
  "parameters": {
    "environment": { "value": "prod" },
    "location": { "value": "westeurope" },
    "prefix": { "value": "nectaria" }
  }
}
```

```bash
./infra/scripts/deploy-infra.sh prod
# Will automatically deploy to westeurope
```

**Deploy to East US:**
```json
// parameters.eastus.json
{
  "parameters": {
    "environment": { "value": "dr" },
    "location": { "value": "eastus" },
    "prefix": { "value": "nectaria" }
  }
}
```

### Verification:
```bash
# Test deployment script respects location
./infra/scripts/deploy-infra.sh dev
# Should show: "📍 Deployment location: uaenorth" (from parameters.dev.json)

# Test with different location
echo '{"parameters":{"location":{"value":"westeurope"}}}' > /tmp/test-params.json
LOCATION=$(jq -r '.parameters.location.value' /tmp/test-params.json)
echo $LOCATION
# Should output: westeurope
```

---

## Summary of All Fixes

| Bug | Severity | Status | Impact |
|-----|----------|--------|--------|
| Event Grid Key Exposed | 🔴 HIGH | ✅ Fixed | Security - Secret exposure |
| TLS Validation Disabled | 🔴 CRITICAL | ✅ Fixed | Security - MITM attacks |
| Hardcoded Location | 🟡 MEDIUM | ✅ Fixed | Flexibility - Multi-region support |

---

**Fixed By:** Security & Infrastructure Review  
**Date:** December 22, 2025  
**Status:** ✅ All issues resolved and validated

