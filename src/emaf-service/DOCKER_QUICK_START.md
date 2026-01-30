# Docker Deployment - Quick Start

## Build & Deploy to Azure in 3 Steps

### Step 1: Build the Docker Image

```bash
cd nectaria-services/src/emaf-service
./docker-build.sh
```

Or use Azure Container Registry directly:

```bash
az acr build \
  --registry interactivecrmacr \
  --image emaf-service:latest \
  --file Dockerfile \
  --platform linux/amd64 \
  .
```

### Step 2: Deploy to Azure Functions

```bash
az functionapp config container set \
  --name emaf-service-func \
  --resource-group Interactive-CRM-Dev \
  --docker-custom-image-name interactivecrmacr.azurecr.io/emaf-service:latest \
  --docker-registry-server-url https://interactivecrmacr.azurecr.io
```

### Step 3: Restart the Function App

```bash
az functionapp restart \
  --name emaf-service-func \
  --resource-group Interactive-CRM-Dev
```

## Verify Deployment

```bash
# Check logs
az functionapp logs tail \
  --name emaf-service-func \
  --resource-group Interactive-CRM-Dev

# Test PDF generation
curl -X POST "https://emaf-service-func.azurewebsites.net/api/customer/emaf/<token>/generate-pdf-direct" \
  -H "Content-Type: application/json" \
  -d '{"leadId": "<lead-id>"}'
```

## What's Fixed

✅ **Playwright browsers installed** - Chromium with all dependencies  
✅ **Arabic fonts** - Full support for Arabic text in PDFs  
✅ **System dependencies** - All required libraries for headless Chrome  
✅ **Permissions** - Browser cache directory is writable  
✅ **Optimized build** - Cached layers, minimal image size  

## Dockerfile Highlights

```dockerfile
# More system dependencies
RUN apt-get install -y libgtk-3-0 libdbus-1-3 libx11-6 ...

# Install browsers separately (after build)
RUN npm ci --ignore-scripts
RUN npm run build  
RUN npx playwright install chromium --with-deps

# Ensure writable browser cache
RUN mkdir -p /home/.cache/ms-playwright && \
    chmod -R 777 /home/.cache/ms-playwright
```

## Troubleshooting

### Still Getting Browser Error?

1. **Rebuild with no cache**:
   ```bash
   docker build --no-cache -t emaf-service:latest .
   ```

2. **Check if using Docker deployment**:
   ```bash
   az functionapp config show \
     --name emaf-service-func \
     --resource-group Interactive-CRM-Dev \
     --query linuxFxVersion
   ```
   
   Should return: `DOCKER|interactivecrmacr.azurecr.io/emaf-service:latest`

3. **Verify browser in container**:
   ```bash
   docker run -it emaf-service:latest /bin/bash
   ls /home/.cache/ms-playwright/
   npx playwright install --dry-run
   ```

### Container Won't Start?

Check logs:
```bash
docker logs <container-id>
```

Common issues:
- Missing environment variables
- Port already in use
- Insufficient memory

## Environment Variables Required

```bash
COSMOS_DB_ENDPOINT=<your-endpoint>
COSMOS_DB_KEY=<your-key>
AZURE_STORAGE_CONNECTION_STRING=<your-connection-string>
BLOB_CONTAINER_NAME=emaf-documents
```

## Next Steps

After successful deployment:
1. Monitor logs for any errors
2. Test with real EMAF submissions  
3. Check PDF output quality
4. Set up alerts for failures

## Support

- Dockerfile: `/nectaria-services/src/emaf-service/Dockerfile`
- Build script: `./docker-build.sh`
- Full guide: `./DOCKER_DEPLOYMENT.md`
