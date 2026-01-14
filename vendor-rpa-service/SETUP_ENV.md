# 🔐 Environment Variables Setup

## Required Environment Variables

The RPA service requires the following environment variables to be configured:

### 1. Cosmos DB Connection String
```bash
export COSMOS_CONNECTION_STRING="AccountEndpoint=https://YOUR_COSMOS_ACCOUNT.documents.azure.com:443/;AccountKey=YOUR_COSMOS_KEY;"
```

**How to get it:**
```bash
az cosmosdb keys list \
  --name interactivecrmdevdb \
  --resource-group Interactive-CRM-Dev \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  -o tsv
```

### 2. Azure Storage Connection String (for queues)
```bash
export AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=YOUR_STORAGE;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net"
```

**How to get it:**
```bash
az storage account show-connection-string \
  --name crmrpastorage36434 \
  --resource-group Interactive-CRM-Dev \
  --query connectionString \
  -o tsv
```

### 3. Event Grid Configuration
```bash
export EVENT_GRID_TOPIC_ENDPOINT="https://YOUR_EVENT_GRID.eventgrid.azure.net/api/events"
export EVENT_GRID_TOPIC_KEY="YOUR_EVENT_GRID_KEY"
```

**How to get it:**
```bash
# Get endpoint
az eventgrid topic show \
  --name interactive-crm-eventgrid \
  --resource-group Interactive-CRM-Dev \
  --query endpoint \
  -o tsv

# Get key
az eventgrid topic key list \
  --name interactive-crm-eventgrid \
  --resource-group Interactive-CRM-Dev \
  --query key1 \
  -o tsv
```

---

## Setup Instructions

### Option 1: Using .env file (Local Development)

1. Copy the example file:
```bash
cp .env.example .env
```

2. Edit `.env` and replace placeholders with actual values

3. Load environment variables:
```bash
source .env  # Linux/Mac
# or
set -a; source .env; set +a  # Linux/Mac (exports all)
```

### Option 2: PM2 Ecosystem (Production on VM)

The `ecosystem.config.js` file reads from `process.env`. Set environment variables before starting PM2:

```bash
# On the VM, create /etc/environment.d/rpa.conf or add to ~/.bashrc:
export COSMOS_CONNECTION_STRING="..."
export AZURE_STORAGE_CONNECTION_STRING="..."
export EVENT_GRID_TOPIC_ENDPOINT="..."
export EVENT_GRID_TOPIC_KEY="..."

# Then start PM2
pm2 start ecosystem.config.js
pm2 save
```

### Option 3: Direct Export (Quick Test)

```bash
export COSMOS_CONNECTION_STRING="..."
export AZURE_STORAGE_CONNECTION_STRING="..."

# Start services
pm2 start ecosystem.config.js
```

---

## ⚠️ Security Notes

1. **NEVER commit `.env` files to Git**
   - Already in `.gitignore`
   
2. **NEVER hardcode secrets in code**
   - Use `process.env.VARIABLE_NAME`
   - Use `os.environ.get('VARIABLE_NAME')`

3. **Rotate keys regularly**
   - Use Azure Key Vault for production

4. **Use different keys for dev/prod**
   - Don't share production keys

---

## Verification

Check if environment variables are set:

```bash
# Check if variables are set
env | grep COSMOS
env | grep AZURE_STORAGE
env | grep EVENT_GRID

# Test PM2 config
pm2 start ecosystem.config.js
pm2 logs alsagr-bot --lines 20
```

---

## Troubleshooting

### "COSMOS_CONNECTION_STRING not set" error

**Solution:** Export the variable before starting PM2:
```bash
export COSMOS_CONNECTION_STRING="..."
pm2 restart all
```

### PM2 doesn't see environment variables

**Solution:** PM2 inherits from the shell that started it. Either:
1. Export variables in the same shell session before starting PM2
2. Add to `/etc/environment` (system-wide)
3. Add to `~/.bashrc` or `~/.profile` (user-specific)

---

## Best Practice (Production)

Use Azure Key Vault to manage secrets:

```javascript
// ecosystem.config.js with Key Vault
const { DefaultAzureCredential } = require('@azure/identity');
const { SecretClient } = require('@azure/keyvault-secrets');

async function getSecrets() {
  const credential = new DefaultAzureCredential();
  const client = new SecretClient('https://your-keyvault.vault.azure.net/', credential);
  
  const cosmosSecret = await client.getSecret('cosmos-connection-string');
  return cosmosSecret.value;
}
```
