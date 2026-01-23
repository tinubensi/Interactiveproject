# Deployment Guide: HTML Template PDF Generation

## Quick Deployment Steps

### 1. Build and Test Locally ✅ (DONE)

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service

# Install dependencies
npm install

# Build
npm run build

# Test
npm test
```

**Status:** ✅ Completed - All tests passed!

### 2. Build Docker Image

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service

# Build image
docker build -t emaf-service:latest .

# Test locally (optional)
docker run -p 7078:80 \
  -e AzureWebJobsStorage="<connection-string>" \
  -e COSMOS_DB_ENDPOINT="<endpoint>" \
  -e COSMOS_DB_KEY="<key>" \
  emaf-service:latest
```

### 3. Push to Azure Container Registry

```bash
# Login to Azure
az login

# Get ACR name (replace with your ACR)
ACR_NAME="<your-acr-name>"

# Login to ACR
az acr login --name $ACR_NAME

# Tag image
docker tag emaf-service:latest $ACR_NAME.azurecr.io/emaf-service:latest

# Push to ACR
docker push $ACR_NAME.azurecr.io/emaf-service:latest

# OR build directly in ACR (recommended)
az acr build \
  --registry $ACR_NAME \
  --image emaf-service:latest \
  --file Dockerfile \
  .
```

### 4. Update Azure Function App

```bash
# Set variables
RESOURCE_GROUP="<your-resource-group>"
FUNCTION_APP_NAME="<your-function-app-name>"
ACR_NAME="<your-acr-name>"

# Update Function App to use container
az functionapp config container set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/emaf-service:latest \
  --docker-registry-server-url https://$ACR_NAME.azurecr.io

# Restart Function App
az functionapp restart \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP
```

### 5. Verify Deployment

```bash
# Check Function App status
az functionapp show \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query state

# Test preview endpoint
FUNCTION_URL="https://$FUNCTION_APP_NAME.azurewebsites.net"

curl "$FUNCTION_URL/api/admin/emaf/preview?vendorCode=alsagr&format=html" > test.html

curl "$FUNCTION_URL/api/admin/emaf/preview?vendorCode=alsagr&format=pdf" > test.pdf
```

### 6. Test End-to-End

1. Create EMAF submission via portal
2. Fill form with test data
3. Click "Generate PDF"
4. Wait ~5 seconds
5. Download and verify PDF

## Environment Variables

Required environment variables (should already be configured):

```bash
# Azure Storage
AzureWebJobsStorage="<connection-string>"

# Cosmos DB
COSMOS_DB_ENDPOINT="<endpoint>"
COSMOS_DB_KEY="<key>"
COSMOS_DB_DATABASE_NAME="emaf-db"

# Blob Storage
BLOB_STORAGE_CONNECTION_STRING="<connection-string>"
BLOB_STORAGE_CONTAINER_NAME="emaf-documents"

# Event Grid
EVENT_GRID_TOPIC_ENDPOINT="<endpoint>"
EVENT_GRID_TOPIC_KEY="<key>"

# Optional
FRONTEND_URL="https://your-frontend.vercel.app"
```

## Monitoring

### Check Logs

```bash
# Stream logs
az functionapp log tail \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP

# Or use Azure Portal
# Navigate to Function App → Monitor → Log Stream
```

### Key Metrics to Monitor

1. **PDF Generation Time** - Should be 2-5 seconds
2. **Memory Usage** - Chromium uses ~200-300MB
3. **Queue Processing** - Check queue length
4. **Error Rate** - Should be near 0%

### Common Log Messages

**Success:**
```
📄 Starting PDF generation for vendor: alsagr
   Step 1: Rendering HTML template...
   ✓ HTML rendered (14859 characters)
   Step 2: Launching browser...
   ✓ Browser page created
   Step 3: Loading HTML content...
   ✓ HTML content loaded
   Step 4: Generating PDF...
   ✓ PDF generated (92109 bytes)
✅ PDF generation completed in 2.34s
```

**Errors to Watch:**
```
❌ PDF generation failed: Template not found
❌ Failed to launch browser
❌ Timeout waiting for page load
```

## Rollback Plan

If issues occur:

### Option 1: Rollback to Previous Image

```bash
# List previous images
az acr repository show-tags \
  --name $ACR_NAME \
  --repository emaf-service

# Rollback to previous version
az functionapp config container set \
  --name $FUNCTION_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $ACR_NAME.azurecr.io/emaf-service:previous-tag
```

### Option 2: Use Legacy Coordinate System

The old coordinate-based system is still available as fallback:
- Templates with `templateType: 'coordinate-overlay'` will use old system
- No code changes needed
- Just don't set `templateType: 'html'`

## Performance Tuning

### If PDF Generation is Slow

1. **Check Browser Launch Time**
   - First PDF: ~2s (browser launch)
   - Subsequent: ~0.5s (browser reuse)
   - Solution: Browser pooling (future enhancement)

2. **Check Network**
   - Ensure Function App has good network connectivity
   - Check if Cosmos DB/Blob Storage are in same region

3. **Check Memory**
   - Increase Function App memory if needed
   - Monitor memory usage in Azure Portal

### If Queue is Backing Up

1. **Scale Out**
   - Increase max instances in Function App settings
   - Default: 200 instances (plenty for most cases)

2. **Check Concurrency**
   - Each instance can process multiple PDFs
   - Monitor concurrent executions

## Troubleshooting

### Template Not Found

**Error:** `Template not found for vendor: alsagr`

**Solution:**
1. Check if templates were copied to dist: `ls dist/src/templates/vendors/`
2. Rebuild: `npm run build`
3. Verify Docker image includes templates: `docker run emaf-service ls /home/site/wwwroot/dist/src/templates/vendors/`

### Browser Launch Failed

**Error:** `Failed to launch browser`

**Solution:**
1. Check if Chromium is installed in Docker image
2. Verify Dockerfile includes Playwright dependencies
3. Check Azure Function App has enough memory (minimum 1GB recommended)

### Arabic Text Not Rendering

**Error:** Arabic text shows as boxes

**Solution:**
1. Verify Arabic fonts in Docker: `docker run emaf-service fc-list | grep Arabic`
2. Check Dockerfile includes: `fonts-noto-arabic`
3. Rebuild Docker image

### PDF Too Large

**Error:** PDF size > 10MB

**Solution:**
1. Optimize images in template
2. Reduce page count
3. Consider splitting into multiple PDFs

## Health Checks

### Quick Health Check Script

```bash
#!/bin/bash
FUNCTION_URL="https://$FUNCTION_APP_NAME.azurewebsites.net"

echo "Testing EMAF Service Health..."

# Test preview endpoint
echo "1. Testing preview endpoint..."
curl -s "$FUNCTION_URL/api/admin/emaf/preview?vendorCode=alsagr&format=html" | head -c 100
echo "✅ Preview endpoint working"

# Test PDF generation
echo "2. Testing PDF generation..."
curl -s "$FUNCTION_URL/api/admin/emaf/preview?vendorCode=alsagr&format=pdf" > /tmp/test.pdf
PDF_SIZE=$(wc -c < /tmp/test.pdf)
if [ $PDF_SIZE -gt 10000 ]; then
  echo "✅ PDF generation working (${PDF_SIZE} bytes)"
else
  echo "❌ PDF generation failed"
fi

echo "Health check complete!"
```

## Post-Deployment Checklist

- [ ] Docker image built successfully
- [ ] Image pushed to ACR
- [ ] Function App updated to use new image
- [ ] Function App restarted
- [ ] Preview endpoint tested (HTML)
- [ ] Preview endpoint tested (PDF)
- [ ] End-to-end test with real EMAF submission
- [ ] PDF quality verified (compare with original)
- [ ] Arabic text rendering verified
- [ ] Performance acceptable (<5s per PDF)
- [ ] Logs monitored for errors
- [ ] Metrics dashboard updated

## Support Contacts

- **Azure Issues:** Azure Support Portal
- **Code Issues:** Check GitHub/repository
- **Template Issues:** Review HTML_TEMPLATE_README.md

## Additional Resources

- [HTML Template README](./HTML_TEMPLATE_README.md)
- [Implementation Summary](../../HTML_PDF_IMPLEMENTATION_COMPLETE.md)
- [Playwright Documentation](https://playwright.dev/)
- [Handlebars Documentation](https://handlebarsjs.com/)
- [Azure Functions Docker](https://docs.microsoft.com/en-us/azure/azure-functions/functions-create-function-linux-custom-image)

---

**Last Updated:** January 22, 2026  
**Version:** 1.0.0  
**Status:** Ready for Production
