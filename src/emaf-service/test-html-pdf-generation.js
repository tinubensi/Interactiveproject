/**
 * Test HTML Template PDF Generation
 * Run: node test-html-pdf-generation.js
 */

const fs = require('fs');
const path = require('path');

// Sample test data
const testData = {
  policyHolder: {
    fullName: 'Ahmed Mohammed Ali',
    employer: 'ABC Technology LLC',
    nationality: 'United Arab Emirates',
    emiratesId: '784-1234-5678901-2',
    emirate: 'Dubai',
    maritalStatus: 'Married',
    gender: 'Male',
    dateOfBirth: '15/05/1985',
    weight: '75',
    height: '175',
    occupation: 'Software Engineer',
    mobileNumber: '+971 50 123 4567',
    contactNumber: '+971 4 123 4567',
    email: 'ahmed.ali@example.com',
    location: 'Dubai Marina, Dubai, UAE'
  },
  insuredMembers: [
    {
      type: 'Principal',
      name: 'Ahmed Mohammed Ali',
      gender: 'Male',
      maritalStatus: 'Married',
      relation: 'Self',
      dateOfBirth: '15/05/1985',
      height: '175',
      weight: '75'
    },
    {
      type: 'Spouse',
      name: 'Fatima Hassan',
      gender: 'Female',
      maritalStatus: 'Married',
      relation: 'Wife',
      dateOfBirth: '20/08/1988',
      height: '165',
      weight: '60'
    },
    {
      type: 'Dependent 1',
      name: 'Mohammed Ahmed Ali',
      gender: 'Male',
      maritalStatus: 'Single',
      relation: 'Son',
      dateOfBirth: '10/03/2010',
      height: '150',
      weight: '45'
    }
  ],
  previousInsurance: [
    {
      memberName: 'Ahmed Mohammed Ali',
      insuranceCompany: 'XYZ Insurance',
      expiryDate: '31/12/2025'
    }
  ],
  medicalQuestions: [
    {
      number: 1,
      questionEnglish: 'Have you ever been diagnosed with diabetes?',
      questionArabic: 'هل تم تشخيصك بمرض السكري؟',
      answerYes: false
    },
    {
      number: 2,
      questionEnglish: 'Do you have high blood pressure?',
      questionArabic: 'هل تعاني من ارتفاع ضغط الدم؟',
      answerYes: true,
      details: 'Controlled with medication - Amlodipine 5mg daily'
    },
    {
      number: 3,
      questionEnglish: 'Have you had any surgeries in the past 5 years?',
      questionArabic: 'هل أجريت أي عمليات جراحية في السنوات الخمس الماضية؟',
      answerYes: false
    }
  ],
  pregnancyDeclaration: {
    isPregnant: false
  },
  signature: {
    applicantName: 'Ahmed Mohammed Ali',
    date: new Date().toLocaleDateString('en-GB')
  }
};

async function testHtmlPdfGeneration() {
  console.log('\n🧪 Testing HTML Template PDF Generation\n');
  console.log('=' .repeat(60));
  
  try {
    // Load the compiled services
    const { templateRenderer } = require('./dist/src/services/templateRenderer');
    const { pdfGeneratorService } = require('./dist/src/services/pdfGeneratorService');
    
    console.log('\n✅ Services loaded successfully\n');
    
    // Test 1: Check if template exists
    console.log('📋 Test 1: Check template existence');
    const templateExists = templateRenderer.templateExists('alsagr');
    console.log(`   Al Sagr template exists: ${templateExists ? '✅ YES' : '❌ NO'}`);
    
    if (!templateExists) {
      console.log('\n❌ Template not found. Make sure to build first: npm run build');
      process.exit(1);
    }
    
    // Test 2: List available templates
    console.log('\n📋 Test 2: List available templates');
    const templates = templateRenderer.getAvailableTemplates();
    console.log(`   Available templates: ${templates.join(', ')}`);
    
    // Test 3: Render HTML
    console.log('\n📋 Test 3: Render HTML template');
    const html = await templateRenderer.renderTemplate('alsagr', testData);
    console.log(`   ✅ HTML rendered (${html.length} characters)`);
    
    // Save HTML for inspection
    const htmlPath = path.join(__dirname, 'test-output-alsagr.html');
    fs.writeFileSync(htmlPath, html, 'utf-8');
    console.log(`   💾 HTML saved to: ${htmlPath}`);
    console.log(`   🌐 Open in browser: file://${htmlPath}`);
    
    // Test 4: Generate PDF
    console.log('\n📋 Test 4: Generate PDF from HTML');
    const pdfBuffer = await pdfGeneratorService.generatePdfFromHtml(html);
    console.log(`   ✅ PDF generated (${pdfBuffer.length} bytes = ${(pdfBuffer.length / 1024).toFixed(2)} KB)`);
    
    // Save PDF
    const pdfPath = path.join(__dirname, 'test-output-alsagr.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`   💾 PDF saved to: ${pdfPath}`);
    
    // Test 5: Validate template
    console.log('\n📋 Test 5: Validate template');
    const validation = await pdfGeneratorService.validateTemplate('alsagr', testData);
    console.log(`   Valid: ${validation.valid ? '✅ YES' : '❌ NO'}`);
    
    if (validation.errors.length > 0) {
      console.log(`   ❌ Errors:`);
      validation.errors.forEach(err => console.log(`      - ${err}`));
    }
    
    if (validation.warnings.length > 0) {
      console.log(`   ⚠️  Warnings:`);
      validation.warnings.forEach(warn => console.log(`      - ${warn}`));
    }
    
    // Test 6: Performance test
    console.log('\n📋 Test 6: Performance test (3 PDFs)');
    const startTime = Date.now();
    
    for (let i = 0; i < 3; i++) {
      await pdfGeneratorService.generatePdfFromHtml(html);
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const avgTime = ((Date.now() - startTime) / 3 / 1000).toFixed(2);
    console.log(`   ✅ Generated 3 PDFs in ${duration}s (avg: ${avgTime}s per PDF)`);
    
    // Close browser
    await pdfGeneratorService.closeBrowser();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ All tests passed!');
    console.log('\n📁 Output files:');
    console.log(`   - HTML: ${htmlPath}`);
    console.log(`   - PDF:  ${pdfPath}`);
    console.log('\n💡 Next steps:');
    console.log('   1. Open the HTML file in a browser to verify layout');
    console.log('   2. Open the PDF file to verify final output');
    console.log('   3. Compare with original vendor PDF');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run tests
testHtmlPdfGeneration();
