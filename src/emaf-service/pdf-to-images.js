/**
 * Convert Al Sagr PDF pages to PNG images for layout analysis
 */

const { pdfToPng } = require('pdf-to-png-converter');
const fs = require('fs');
const path = require('path');

const PDF_PATH = '/home/janees/Desktop/crm/MAF Al Sagr .pdf';
const OUTPUT_DIR = path.join(__dirname, 'pdf-pages');

async function convertPdfToImages() {
  console.log('🖼️  Converting PDF pages to images...\n');
  
  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  
  // Convert PDF to PNG images
  const pngPages = await pdfToPng(PDF_PATH, {
    outputFolder: OUTPUT_DIR,
    viewportScale: 2.0,  // Higher quality
    outputFileMask: 'alsagr-page-',
    strictPagesToProcess: false,
    verbosityLevel: 0
  });
  
  console.log(`✅ Converted ${pngPages.length} pages`);
  pngPages.forEach((page, i) => {
    console.log(`   Page ${i + 1}: ${page.name}`);
  });
  
  console.log(`\n📁 Images saved in: ${OUTPUT_DIR}`);
  console.log(`\n💡 Next steps:`);
  console.log(`   1. Open images to see exact layout`);
  console.log(`   2. Recreate HTML template matching the original`);
  console.log(`   3. Replace handlebars variables for dynamic data\n`);
}

convertPdfToImages().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
