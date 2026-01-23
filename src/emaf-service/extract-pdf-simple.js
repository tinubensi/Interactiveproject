/**
 * Extract text and approximate layout from Al Sagr PDF
 * Using pdf-parse for Node.js compatibility
 */

const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const PDF_PATH = '/home/janees/Desktop/crm/MAF Al Sagr .pdf';
const OUTPUT_TXT = path.join(__dirname, 'alsagr-pdf-text-layout.txt');

async function extractPdfText() {
  console.log('🔍 Extracting text from Al Sagr PDF...\n');
  
  const dataBuffer = fs.readFileSync(PDF_PATH);
  
  const data = await pdf(dataBuffer);
  
  console.log(`📄 PDF Info:`);
  console.log(`   Pages: ${data.numpages}`);
  console.log(`   Text length: ${data.text.length} characters`);
  console.log(`\n📝 Extracted Text:\n`);
  console.log('='.repeat(80));
  console.log(data.text);
  console.log('='.repeat(80));
  
  // Save to file
  fs.writeFileSync(OUTPUT_TXT, data.text);
  console.log(`\n✅ Text saved to: ${OUTPUT_TXT}`);
  
  // Analyze structure
  const lines = data.text.split('\n').filter(l => l.trim());
  console.log(`\n📊 Analysis:`);
  console.log(`   Total lines: ${lines.length}`);
  console.log(`   First 20 lines:`);
  lines.slice(0, 20).forEach((line, i) => {
    console.log(`   ${String(i + 1).padStart(3, ' ')}: ${line.substring(0, 70)}`);
  });
}

extractPdfText().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
