# Fix Azure Functions Core Tools Deployment Issue

## Problem
The `func` command is failing with:
```
Error: spawn /usr/lib/node_modules/azure-functions-core-tools/bin/func ENOENT
```

The Azure Functions Core Tools installation is incomplete or corrupted.

## Solution Options

### Option 1: Install Locally and Use npx (Easiest - No sudo required) ✅

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/pipeline-service

# Install Azure Functions Core Tools locally
npm install --save-dev azure-functions-core-tools@4

# Build the project
npm run build

# Deploy using npx
npx func azure functionapp publish func-nectaria-pipeline-dev
```

This is the **recommended solution** as it doesn't require sudo and works immediately.

### Option 2: Reinstall Azure Functions Core Tools Globally (Requires sudo)

```bash
# Uninstall the broken installation
sudo npm uninstall -g azure-functions-core-tools

# Reinstall it
sudo npm install -g azure-functions-core-tools@4

# Verify installation
func --version
```

### Option 3: Use Azure CLI to Deploy (Alternative)

If you can't use sudo, you can deploy using Azure CLI:

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/pipeline-service

# Build the project first
npm run build

# Create deployment package
zip -r deployment.zip . -x "*.git*" "node_modules/*" "*.md" "*.test.*"

# Deploy using Azure CLI
az functionapp deployment source config-zip \
  --resource-group <your-resource-group> \
  --name func-nectaria-pipeline-dev \
  --src deployment.zip
```

To find your resource group:
```bash
az functionapp show --name func-nectaria-pipeline-dev --query resourceGroup -o tsv
```

### Option 4: Use VS Code Azure Functions Extension

1. Install the "Azure Functions" extension in VS Code
2. Sign in to Azure
3. Right-click on the `pipeline-service` folder
4. Select "Deploy to Function App"
5. Choose `func-nectaria-pipeline-dev`

### Option 5: Manual Fix of Current Installation

If the zip file is corrupted, try:

```bash
# Remove the corrupted zip
sudo rm /usr/lib/node_modules/azure-functions-core-tools/bin/Azure.Functions.Cli.linux-x64.4.6.0.zip

# Reinstall the package
sudo npm install -g azure-functions-core-tools@4 --force
```

## Quick Fix Command (Recommended)

Run this to fix and deploy (no sudo required):

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/pipeline-service

# Install locally
npm install --save-dev azure-functions-core-tools@4

# Build
npm run build

# Deploy using npx
npx func azure functionapp publish func-nectaria-pipeline-dev
```

## Alternative: Fix Global Installation

If you prefer to fix the global installation (requires sudo):

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/pipeline-service

# Fix installation (requires sudo password)
sudo npm uninstall -g azure-functions-core-tools && \
sudo npm install -g azure-functions-core-tools@4

# Verify
func --version

# Build
npm run build

# Deploy
func azure functionapp publish func-nectaria-pipeline-dev
```

## After Fixing

Once the installation is fixed, you can deploy normally:

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/pipeline-service
npm run build
func azure functionapp publish func-nectaria-pipeline-dev
```
