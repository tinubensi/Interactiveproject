/**
 * Extract layout from original Al Sagr PDF
 * This will convert the PDF to HTML with exact positioning
 */

const fs = require('fs');
const path = require('path');
const pdfjsLib = require('pdfjs-dist');

// Set up worker for PDF.js
const pdfjsWorker = require('pdfjs-dist/build/pdf.worker.entry');
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// Original PDF path
const PDF_PATH = '/home/janees/Desktop/crm/MAF Al Sagr .pdf';
const OUTPUT_HTML = path.join(__dirname, 'src/templates/vendors/alsagr-emaf-extracted.hbs');

async function extractPdfLayout() {
  console.log('🔍 Extracting layout from original Al Sagr PDF...\n');
  
  // Load PDF
  const pdfData = new Uint8Array(fs.readFileSync(PDF_PATH));
  const loadingTask = pdfjsLib.getDocument({ data: pdfData });
  const pdfDocument = await loadingTask.promise;
  
  console.log(`📄 PDF loaded: ${pdfDocument.numPages} pages\n`);
  
  let htmlOutput = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Medical Application Form - Al Sagr Insurance</title>
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: Arial, sans-serif;
      background: white;
    }
    
    .page {
      position: relative;
      width: 210mm;
      min-height: 297mm;
      background: white;
      page-break-after: always;
    }
    
    .text-item {
      position: absolute;
      white-space: pre;
    }
    
    .field {
      position: absolute;
      border-bottom: 1px solid #000;
      min-width: 50px;
    }
    
    @media print {
      body { margin: 0; }
      .page { page-break-after: always; }
    }
  </style>
</head>
<body>
`;

  // Extract each page
  for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
    console.log(`Processing page ${pageNum}...`);
    
    const page = await pdfDocument.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.0 });
    const textContent = await page.getTextContent();
    
    // Convert PDF points to mm (A4 = 210mm x 297mm)
    const pdfWidth = viewport.width;
    const pdfHeight = viewport.height;
    const mmWidth = 210;
    const mmHeight = 297;
    const scaleX = mmWidth / pdfWidth;
    const scaleY = mmHeight / pdfHeight;
    
    htmlOutput += `\n  <div class="page" id="page-${pageNum}">\n`;
    
    // Extract text items with positions
    const items = textContent.items;
    console.log(`   Found ${items.length} text items`);
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const text = item.str.trim();
      
      if (!text) continue;
      
      // Convert coordinates
      const x = (item.transform[4] * scaleX).toFixed(2);
      const y = ((pdfHeight - item.transform[5]) * scaleY).toFixed(2);
      const fontSize = (item.transform[0] * scaleY).toFixed(2);
      
      // Detect if it's a field label or actual content
      const isLabel = text.includes(':') || text.match(/^[A-Z\s]+$/);
      
      htmlOutput += `    <div class="text-item ${isLabel ? 'label' : 'value'}" style="left: ${x}mm; top: ${y}mm; font-size: ${fontSize}pt;">${escapeHtml(text)}</div>\n`;
    }
    
    htmlOutput += `  </div>\n`;
    console.log(`   ✓ Page ${pageNum} extracted\n`);
  }
  
  htmlOutput += `</body>\n</html>`;
  
  // Save to file
  fs.writeFileSync(OUTPUT_HTML, htmlOutput);
  console.log(`✅ HTML template saved to: ${OUTPUT_HTML}`);
  console.log(`📏 Total pages: ${pdfDocument.numPages}`);
  console.log(`📐 Page size: 210mm x 297mm (A4)`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Open ${OUTPUT_HTML} in browser to see the layout`);
  console.log(`   2. Replace static text with Handlebars variables {{field}}`);
  console.log(`   3. Test with actual data\n`);
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Run extraction
extractPdfLayout().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
