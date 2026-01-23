# HTML Template PDF Generation System

## Overview

The EMAF service now supports generating PDFs from HTML templates using Playwright. This replaces the complex coordinate-based mapping system with a simpler, more maintainable approach.

## Architecture

```
User Form Data (JSON)
    ↓
Handlebars Template Renderer
    ↓
Rendered HTML
    ↓
Playwright (Chromium)
    ↓
Generated PDF
```

## Benefits

✅ **Easier Maintenance** - Edit HTML/CSS instead of coordinate mappings  
✅ **Native Arabic Support** - Browser handles RTL text automatically  
✅ **Visual Preview** - View HTML in browser before generating PDF  
✅ **Faster Development** - Frontend developers can create templates  
✅ **Better Accuracy** - CSS layouts more precise than manual coordinates  
✅ **Reusable Components** - Handlebars partials for common elements  

## File Structure

```
src/
├── templates/
│   ├── vendors/
│   │   ├── alsagr-emaf.hbs       ← Al Sagr template
│   │   ├── watania-emaf.hbs      ← Other vendors
│   │   └── ...
│   ├── partials/                 ← Reusable components
│   └── styles/                   ← Shared CSS
├── services/
│   ├── templateRenderer.ts       ← Handlebars rendering
│   └── pdfGeneratorService.ts    ← Playwright PDF generation
└── functions/
    └── admin/
        └── previewTemplate.ts    ← Preview endpoint
```

## Quick Start

### 1. Install Dependencies

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service
npm install
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Test PDF Generation

```bash
node test-html-pdf-generation.js
```

This will:
- Render the Al Sagr template with sample data
- Generate HTML and save to `test-output-alsagr.html`
- Generate PDF and save to `test-output-alsagr.pdf`
- Run validation and performance tests

### 4. Preview in Browser

Open the generated HTML file:

```bash
# Linux
xdg-open test-output-alsagr.html

# macOS
open test-output-alsagr.html

# Or manually open in browser
```

## Creating Templates

### Template Structure

Templates use Handlebars syntax:

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    @page { size: A4; margin: 15mm; }
    /* ... CSS styles ... */
  </style>
</head>
<body>
  <!-- Static content -->
  <h1>Medical Application Form</h1>
  
  <!-- Dynamic content -->
  <p>Name: {{policyHolder.fullName}}</p>
  
  <!-- Loops -->
  {{#each insuredMembers}}
    <tr>
      <td>{{this.name}}</td>
      <td>{{this.dateOfBirth}}</td>
    </tr>
  {{/each}}
  
  <!-- Conditionals -->
  {{#if pregnancyDeclaration.isPregnant}}
    <p>Pregnant: Yes</p>
  {{else}}
    <p>Pregnant: No</p>
  {{/if}}
  
  <!-- Checkboxes -->
  <span class="checkbox {{#if answer}}checked{{/if}}"></span>
</body>
</html>
```

### Available Handlebars Helpers

- `{{formatDate date}}` - Format date as DD/MM/YYYY
- `{{uppercase str}}` - Convert to uppercase
- `{{lowercase str}}` - Convert to lowercase
- `{{default value "fallback"}}` - Use fallback if value is empty
- `{{join array ", "}}` - Join array with separator
- `{{eq a b}}` - Check equality
- `{{gt a b}}` - Greater than
- `{{lt a b}}` - Less than

## API Endpoints

### Preview Template (Admin)

**HTML Preview:**
```bash
GET /api/admin/emaf/preview?vendorCode=alsagr&format=html
```

**PDF Preview:**
```bash
GET /api/admin/emaf/preview?vendorCode=alsagr&format=pdf
```

**Screenshot Preview:**
```bash
GET /api/admin/emaf/preview?vendorCode=alsagr&format=screenshot
```

**With Custom Data:**
```bash
POST /api/admin/emaf/preview?vendorCode=alsagr&format=pdf
Content-Type: application/json

{
  "formData": {
    "policyHolder": {
      "fullName": "Test User",
      ...
    }
  }
}
```

## Docker Deployment

### Build Docker Image

```bash
cd /home/janees/Desktop/crm/Interactiveproject/src/emaf-service

# Build image
docker build -t emaf-service:latest .

# Test locally
docker run -p 7078:80 emaf-service:latest
```

### Deploy to Azure

```bash
# Push to Azure Container Registry
az acr build \
  --registry <your-acr-name> \
  --image emaf-service:latest \
  --file Dockerfile \
  .

# Update Function App
az functionapp config container set \
  --name <function-app-name> \
  --resource-group <resource-group> \
  --docker-custom-image-name <acr-name>.azurecr.io/emaf-service:latest
```

## Testing

### Local Testing

```bash
# Run test script
node test-html-pdf-generation.js

# Start function app locally
npm start

# Test preview endpoint
curl http://localhost:7078/api/admin/emaf/preview?vendorCode=alsagr > test.html
```

### Visual Comparison

1. Generate PDF with test data
2. Open original vendor PDF side-by-side
3. Compare:
   - Layout and spacing
   - Font sizes and styles
   - Arabic text rendering
   - Table borders and alignment
   - Page breaks

## Performance

- **HTML Rendering:** ~50-100ms
- **PDF Generation:** ~2-5 seconds
- **Total:** ~2-5 seconds per PDF

Well within Azure Functions 5-minute timeout! ✅

## Troubleshooting

### Template Not Found

```
Error: Template not found for vendor: alsagr
```

**Solution:** Make sure template file exists at `src/templates/vendors/alsagr-emaf.hbs`

### Chromium Launch Failed

```
Error: Failed to launch browser
```

**Solution:** Install Playwright browsers:
```bash
npx playwright install chromium
```

### Arabic Text Not Rendering

**Solution:** Make sure Arabic fonts are installed in Docker:
```dockerfile
RUN apt-get install -y fonts-noto-arabic
```

### PDF Too Large

**Solution:** Optimize images and reduce page count. Consider splitting into multiple PDFs.

## Migration from Coordinate System

### For New Vendors

1. Create HTML template in `src/templates/vendors/`
2. Set `templateType: 'html'` in EmafTemplate
3. Test with preview endpoint
4. Deploy

### For Existing Vendors

1. Keep existing coordinate mappings (backward compatible)
2. Create HTML template
3. Test side-by-side
4. Update `templateType` to 'html' when ready
5. Old system continues to work until migration complete

## Next Steps

1. ✅ Al Sagr template created
2. ⏳ Test with real EMAF data
3. ⏳ Deploy to Azure with Docker
4. ⏳ Create templates for other vendors (Watania, MetLife, etc.)
5. ⏳ Migrate existing vendors from coordinate system

## Support

For issues or questions:
- Check logs in Azure Functions
- Test locally with `test-html-pdf-generation.js`
- Use preview endpoint to debug HTML
- Compare generated PDF with original vendor PDF
