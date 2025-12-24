# Nectaria Infrastructure as Code

This directory contains Bicep infrastructure-as-code templates for deploying all 13 Nectaria microservices and supporting Azure resources.

## 📋 Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Detailed Instructions](#detailed-instructions)
- [Azure DevOps Pipeline](#azure-devops-pipeline)
- [Configuration](#configuration)
- [Troubleshooting](#troubleshooting)
- [Cost Estimation](#cost-estimation)

## 🎯 Overview

This infrastructure deployment includes:

- **13 Function Apps** (Node.js 20, Consumption Plan)
- **1 Cosmos DB Account** with 14 databases and 30+ containers
- **1 Event Grid Topic** for event-driven communication
- **2 Storage Accounts** (functions runtime + document storage)
- **1 Key Vault** for secrets management
- **1 Application Insights** for monitoring
- **1 App Service Plan** (Consumption tier)

All resources are deployed to a single resource group and configured for inter-service communication.

## ✅ Prerequisites

### Required Tools

1. **Azure CLI** (v2.50+)
   ```bash
   # Check version
   az --version
   
   # Install if needed
   curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash
   ```

2. **Bicep CLI** (included with Azure CLI)
   ```bash
   # Verify Bicep
   az bicep version
   ```

3. **Node.js 20+** (for building services)
   ```bash
   node --version
   npm --version
   ```

4. **jq** (for JSON parsing in scripts)
   ```bash
   sudo apt install jq  # Ubuntu/Debian
   brew install jq      # macOS
   ```

### Azure Requirements

- Azure subscription with Contributor access
- Permissions to create resource groups
- Service Principal or logged-in user account

### Azure AD Setup (Optional, for Authentication Service)

If deploying the authentication service with Azure AD B2B:

1. Create App Registration in Azure AD
2. Configure redirect URIs
3. Create client secret
4. Note Tenant ID and Client ID

See [Azure AD Configuration Guide](../docs/INFRASTRUCTURE_SETUP.md#1-azure-ad-b2b-configuration)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Azure Subscription                          │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Resource Group: rg-nectaria-dev                          │ │
│  │                                                           │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │ │
│  │  │  Function    │  │  Function    │  │  Function    │  │ │
│  │  │  App 1       │  │  App 2       │  │  App 3...13  │  │ │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │ │
│  │         │                 │                 │           │ │
│  │         └─────────────────┴─────────────────┘           │ │
│  │                           │                              │ │
│  │         ┌─────────────────┴─────────────────┐           │ │
│  │         │                                   │           │ │
│  │    ┌────▼─────┐                      ┌─────▼────┐      │ │
│  │    │ Cosmos   │                      │  Event   │      │ │
│  │    │ DB       │                      │  Grid    │      │ │
│  │    │ 14 DBs   │                      │  Topic   │      │ │
│  │    └──────────┘                      └──────────┘      │ │
│  │                                                         │ │
│  │    ┌──────────┐       ┌──────────┐    ┌──────────┐   │ │
│  │    │  Key     │       │ Storage  │    │   App    │   │ │
│  │    │  Vault   │       │ Account  │    │ Insights │   │ │
│  │    └──────────┘       └──────────┘    └──────────┘   │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Service List

| Service | Database | Port (Local) | Description |
|---------|----------|--------------|-------------|
| authentication | auth-db | 7071 | Azure AD B2B authentication |
| authorization | authz-db | 7072 | Role-based access control |
| audit | audit-db | 7073 | Audit logging |
| staff-management | staff-db | 7074 | Staff and team management |
| notification | notification-db | 7075 | Email/SMS notifications |
| customer | customer-db | 7076 | Customer CRM |
| form | form-db | 7077 | Dynamic form builder |
| lead | lead-db | 7078 | Lead management |
| quotation | quotation-db | 7079 | Quotation management |
| quotation-generation | quotation-gen-db | 7080 | Quote generation engine |
| policy | policy-db | 7081 | Policy lifecycle |
| document | document-db | 7082 | Document storage |
| pipeline | pipeline-db | 7090 | Workflow orchestration |

## 🚀 Quick Start

### Option 1: Local Deployment (Manual)

```bash
# 1. Login to Azure
az login
az account set --subscription <your-subscription-id>

# 2. Update parameters (optional)
nano infra/parameters.dev.json

# 3. Deploy infrastructure
cd nectaria-services
./infra/scripts/deploy-infra.sh dev

# 4. Configure secrets
./infra/scripts/post-deployment.sh dev

# 5. Build and package services
./infra/scripts/build-all-services.sh
./infra/scripts/package-services.sh

# 6. Deploy function code (manual per service)
az functionapp deployment source config-zip \
  --resource-group rg-nectaria-dev \
  --name func-nectaria-authentication-dev \
  --src artifacts/authentication-service.zip
```

### Option 2: Azure DevOps Pipeline (Automated)

```bash
# 1. Push code to Azure Repos or GitHub
git add .
git commit -m "Add infrastructure as code"
git push origin main

# 2. Create Azure DevOps pipeline from azure-pipelines-infra.yml

# 3. Configure pipeline variables:
#    - azureSubscription: Your service connection name
#    - environment: dev

# 4. Run pipeline - it will automatically:
#    - Build all services
#    - Package artifacts
#    - Deploy infrastructure
#    - Configure secrets
#    - Deploy function code
```

## 📚 Detailed Instructions

### Step 1: Prepare Parameters File

Edit `infra/parameters.dev.json`:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "environment": {
      "value": "dev"
    },
    "location": {
      "value": "uaenorth"
    },
    "prefix": {
      "value": "nectaria"
    },
    "azureAdTenantId": {
      "value": "your-tenant-id"
    },
    "azureAdClientId": {
      "value": "your-client-id"
    }
  }
}
```

### Step 2: Deploy Infrastructure

```bash
# Navigate to project root
cd nectaria-services

# Run deployment script
./infra/scripts/deploy-infra.sh dev <subscription-id>

# The script will:
# 1. Validate your Azure login
# 2. Validate Bicep templates
# 3. Ask for confirmation
# 4. Deploy all resources (~10-15 minutes)
# 5. Display deployment outputs
```

**Expected Output:**
```
✅ Infrastructure deployment successful!

================================================
Deployment Outputs
================================================
Resource Group: rg-nectaria-dev
Cosmos DB Endpoint: https://cosmos-nectaria-dev.documents.azure.com:443/
Event Grid Endpoint: https://egt-nectaria-events-dev.uaenorth-1.eventgrid.azure.net/api/events
Key Vault Name: kv-nectaria-dev

Function Apps:
  - authentication: https://func-nectaria-authentication-dev.azurewebsites.net
  - authorization: https://func-nectaria-authorization-dev.azurewebsites.net
  ...
```

### Step 3: Configure Secrets

```bash
# Run post-deployment script
./infra/scripts/post-deployment.sh dev

# This will:
# 1. Retrieve Cosmos DB key and store in Key Vault
# 2. Generate internal service key
# 3. Generate JWT secret
# 4. Prompt for Azure AD client secret (optional)
```

### Step 4: Build Services

```bash
# Build all TypeScript services
./infra/scripts/build-all-services.sh

# This compiles TypeScript to JavaScript for all 13 services
# Output: dist/ folders in each service directory
```

### Step 5: Package Services

```bash
# Create deployment packages
./infra/scripts/package-services.sh

# This creates zip files for each service
# Output: artifacts/*.zip (13 zip files)
```

### Step 6: Deploy Function Code

Deploy each service package to its function app:

```bash
# Example: Deploy authentication service
az functionapp deployment source config-zip \
  --resource-group rg-nectaria-dev \
  --name func-nectaria-authentication-dev \
  --src artifacts/authentication-service.zip \
  --build-remote false

# Repeat for all 13 services or use a loop:
for service in authentication authorization audit staff-management notification customer form lead quotation quotation-generation policy document pipeline; do
  echo "Deploying $service..."
  az functionapp deployment source config-zip \
    --resource-group rg-nectaria-dev \
    --name "func-nectaria-$service-dev" \
    --src "artifacts/${service}-service.zip" \
    --build-remote false
done
```

## 🔄 Azure DevOps Pipeline

### Setup

1. **Create Service Connection**
   - Azure DevOps → Project Settings → Service connections
   - New service connection → Azure Resource Manager
   - Name: `Nectaria-Azure-Connection`

2. **Create Pipeline**
   - Pipelines → New pipeline
   - Select repository
   - Existing Azure Pipelines YAML file
   - Path: `/nectaria-services/azure-pipelines-infra.yml`

3. **Configure Variables**
   - Edit pipeline → Variables
   - Update `azureSubscription` if needed

4. **Run Pipeline**
   - Save and run
   - Monitor progress through 6 stages

### Pipeline Stages

1. **Build** - Compile all TypeScript services
2. **Package** - Create deployment zips
3. **Deploy Infrastructure** - Run Bicep templates
4. **Configure Secrets** - Set Key Vault secrets
5. **Deploy Code** - Upload zips to function apps
6. **Validate** - Health checks

## ⚙️ Configuration

### Service Configuration

All service metadata is centralized in `infra/service-config.json`:

```json
{
  "services": [
    {
      "name": "authentication",
      "database": "auth-db",
      "port": 7071,
      "containers": [...]
    }
  ]
}
```

This file is consumed by Bicep templates to dynamically create databases and containers.

### Environment-Specific Settings

Create additional parameter files for other environments:

```bash
cp infra/parameters.dev.json infra/parameters.staging.json
cp infra/parameters.dev.json infra/parameters.prod.json
```

Update values accordingly (e.g., different Azure AD tenants, locations).

### Key Vault Secrets

The following secrets are managed in Key Vault:

| Secret Name | Description | Auto-Generated |
|-------------|-------------|----------------|
| cosmos-key | Cosmos DB primary key | ✅ |
| internal-service-key | Service-to-service auth | ✅ |
| jwt-secret | JWT signing key | ✅ |
| azure-ad-client-secret | Azure AD app secret | ❌ Manual |

**To manually set Azure AD secret:**
```bash
az keyvault secret set \
  --vault-name kv-nectaria-dev \
  --name azure-ad-client-secret \
  --value "your-azure-ad-secret"
```

## 🐛 Troubleshooting

### Issue: Bicep Validation Failed

**Solution:**
```bash
# Validate template locally
cd infra
az bicep build --file main.bicep

# Check for syntax errors in modules
az bicep build --file modules/cosmos-db.bicep
```

### Issue: Storage Account Name Conflict

**Error:** `StorageAccountAlreadyTaken`

**Solution:** Storage account names must be globally unique. Update `prefix` parameter:
```json
"prefix": { "value": "nectaria2" }
```

### Issue: Function App Deployment Failed

**Solution:**
```bash
# Check function app logs
az functionapp log tail \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev

# Restart function app
az functionapp restart \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev
```

### Issue: Key Vault Access Denied

**Error:** `Forbidden: The user, group or application does not have secrets get permission`

**Solution:**
```bash
# Grant yourself Key Vault Secrets Officer role
az role assignment create \
  --role "Key Vault Secrets Officer" \
  --assignee <your-email> \
  --scope /subscriptions/<sub-id>/resourceGroups/rg-nectaria-dev/providers/Microsoft.KeyVault/vaults/kv-nectaria-dev
```

### Issue: Cosmos DB Connection Failed

**Solution:** Verify Key Vault reference is working:
```bash
# Test secret retrieval
az keyvault secret show \
  --vault-name kv-nectaria-dev \
  --name cosmos-key \
  --query value -o tsv

# Check function app configuration
az functionapp config appsettings list \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev \
  --query "[?name=='COSMOS_KEY']"
```

## 💰 Cost Estimation

### Monthly Costs (Dev Environment)

| Resource | Tier | Estimated Cost (USD) |
|----------|------|----------------------|
| Function Apps (13) | Consumption | $0-50 (usage-based) |
| Cosmos DB (14 databases) | 400 RU/s each | ~$280 |
| Event Grid | Standard | ~$5 |
| Storage Accounts (2) | Standard LRS | ~$5 |
| Key Vault | Standard | ~$3 |
| Application Insights | Pay-as-you-go | ~$10 |
| **Total** | | **~$300-350/month** |

### Cost Optimization Tips

1. **Cosmos DB**: Use shared throughput (400 RU/s per database)
2. **Function Apps**: Consumption plan scales to zero
3. **Storage**: Use Standard LRS for dev environments
4. **Dev/Test**: Delete resource group when not in use

```bash
# Delete everything to stop costs
az group delete --name rg-nectaria-dev --yes --no-wait
```

## 📖 Additional Resources

- [Azure Bicep Documentation](https://learn.microsoft.com/en-us/azure/azure-resource-manager/bicep/)
- [Azure Functions Best Practices](https://learn.microsoft.com/en-us/azure/azure-functions/functions-best-practices)
- [Cosmos DB Best Practices](https://learn.microsoft.com/en-us/azure/cosmos-db/best-practice-guide)
- [Project Architecture](../docs/ARCHITECTURE_CONTEXT.MD)
- [Infrastructure Setup Guide](../docs/INFRASTRUCTURE_SETUP.md)

## 🤝 Contributing

When adding new services:

1. Update `infra/service-config.json` with service metadata
2. Add service code to `src/<service-name>/`
3. Update build and package scripts if needed
4. Bicep templates will automatically create resources

## 📝 License

Copyright © 2025 Nectaria. All rights reserved.

