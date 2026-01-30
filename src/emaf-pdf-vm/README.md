# EMAF PDF Generation Service (VM)

PDF generation service for EMAF that runs on Azure VM using pm2 and nginx.

## Overview

This service handles PDF generation using Playwright/Chromium, running as a Node.js Express application on your Azure VM. It coexists with your existing bots and uses the same infrastructure (pm2, nginx).

## Architecture

- **Express API** on port 8080
- **pm2** process manager
- **nginx** reverse proxy (routes `/api/pdf/*` to localhost:8080)
- **Playwright** for HTML-to-PDF conversion

## Quick Start

### 1. Deploy to VM

```bash
cd nectaria-services/src/emaf-pdf-vm
./deploy.sh
```

### 2. Configure Environment Variables

On the VM, create `.env` file:

```bash
ssh azureuser@20.203.51.248
cd /home/azureuser/emaf-pdf-service
cp .env.example .env
# Edit .env with your credentials
```

Required variables:
- `COSMOS_CONNECTION_STRING`
- `COSMOS_DATABASE_NAME`
- `COSMOS_TEMPLATES_CONTAINER`
- `COSMOS_SUBMISSIONS_CONTAINER`
- `BLOB_STORAGE_CONNECTION_STRING`
- `BLOB_CONTAINER_NAME`

### 3. Configure nginx

Add the location block from `nginx-config.conf` to your nginx server configuration:

```bash
sudo nano /etc/nginx/sites-available/default
# Add the location block
sudo nginx -t
sudo nginx -s reload
```

### 4. Test

```bash
# Health check
curl http://20.203.51.248/api/pdf/health

# PDF generation (via Function App)
# POST /api/customer/emaf/{submissionId}/generate-pdf
```

## Endpoints

- `GET /health` - Health check
- `POST /api/generate-pdf` - Generate PDF (body: `{submissionId, leadId}`)

## Management

### Check Status
```bash
ssh azureuser@20.203.51.248 "pm2 status emaf-pdf-service"
```

### View Logs
```bash
ssh azureuser@20.203.51.248 "pm2 logs emaf-pdf-service"
```

### Restart Service
```bash
ssh azureuser@20.203.51.248 "pm2 restart emaf-pdf-service"
```

### Stop Service
```bash
ssh azureuser@20.203.51.248 "pm2 stop emaf-pdf-service"
```

## Function App Integration

The Function App calls this service via HTTP. Set the environment variable:

```
VM_PDF_SERVICE_URL=http://20.203.51.248/api/pdf
```

The Function App will automatically retry 3 times with 2-second delays if the VM is temporarily unavailable.

## Troubleshooting

### Service won't start
- Check logs: `pm2 logs emaf-pdf-service`
- Verify .env file exists and has correct values
- Check Playwright browsers: `npx playwright install chromium --with-deps`

### nginx 502 Bad Gateway
- Verify service is running: `pm2 status`
- Check service logs for errors
- Verify nginx config: `sudo nginx -t`

### PDF generation fails
- Check Cosmos DB connection
- Verify blob storage credentials
- Check template files exist in `templates/vendors/`

## Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run locally
npm start

# Development mode (with ts-node)
npm run dev
```

## File Structure

```
emaf-pdf-vm/
├── src/
│   ├── server.ts              # Express server
│   ├── config.ts              # Configuration
│   ├── models/                 # Type definitions
│   └── services/               # Business logic
│       ├── cosmosService.ts
│       ├── blobService.ts
│       ├── pdfGeneratorService.ts
│       └── templateRenderer.ts
├── templates/
│   └── vendors/                # Handlebars templates
├── dist/                       # Compiled JavaScript
├── package.json
├── tsconfig.json
├── ecosystem.config.js         # pm2 config
├── deploy.sh                   # Deployment script
└── nginx-config.conf           # nginx configuration
