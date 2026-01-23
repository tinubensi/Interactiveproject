const fs = require('fs');
const { PDFDocument } = require('pdf-lib');

/**
 * Inspect the generated PDF to verify checkbox states
 */

async function inspectGeneratedPdf() {
  console.log('🔍 Inspecting Generated PDF');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Load the generated PDF
    const pdfBytes = fs.readFileSync('test-generated.pdf');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const form = pdfDoc.getForm();
    
    console.log('📄 PDF loaded successfully');
    console.log('');

    // Get all checkboxes
    const fields = form.getFields();
    const checkboxes = fields.filter(f => f.constructor.name === 'PDFCheckBox');
    
    console.log(`📊 Total fields: ${fields.length}`);
    console.log(`☑️  Total checkboxes: ${checkboxes.length}`);
    console.log('');

    // Expected test data
    const expectedChecked = {
      // Principal
      'Check Box106': 'YES - Principal medical observation',
      'Check Box107': 'NO - Principal medical observation', // Should NOT be checked
      'Check Box118': 'NO - Principal medications',
      'Check Box119': 'YES - Principal medications', // Should NOT be checked
      'Check Box130': 'NO - Principal surgery',
      'Check Box131': 'YES - Principal surgery', // Should NOT be checked
      'Check Box142': 'YES - Principal blood tests',
      'Check Box143': 'NO - Principal blood tests', // Should NOT be checked
      
      // Dependent 1
      'Check Box108': 'YES - Dependent 1 medical observation', // Should NOT be checked
      'Check Box109': 'NO - Dependent 1 medical observation',
      'Check Box120': 'YES - Dependent 1 medications',
      'Check Box121': 'NO - Dependent 1 medications', // Should NOT be checked
      'Check Box132': 'NO - Dependent 1 surgery',
      'Check Box133': 'YES - Dependent 1 surgery', // Should NOT be checked
      'Check Box144': 'YES - Dependent 1 blood tests', // Should NOT be checked
      'Check Box145': 'NO - Dependent 1 blood tests',
      
      // Individual questions
      'Check Box70': 'NO - Heart Disease', // Should NOT be checked
      'Check Box72': 'YES - High Blood Pressure',
      'Check Box74': 'YES - Diabetes', // Should NOT be checked
      'Check Box68': 'NO - Family member not applied'
    };

    // Check which checkboxes are actually checked
    const checkedBoxes = [];
    const uncheckedBoxes = [];
    
    for (const checkbox of checkboxes) {
      const name = checkbox.getName();
      const isChecked = checkbox.isChecked();
      
      if (isChecked) {
        checkedBoxes.push({
          name,
          description: expectedChecked[name] || 'Unknown'
        });
      } else {
        uncheckedBoxes.push(name);
      }
    }

    console.log('✅ CHECKED CHECKBOXES:');
    console.log('-'.repeat(80));
    if (checkedBoxes.length === 0) {
      console.log('   ⚠️  WARNING: No checkboxes are checked!');
    } else {
      checkedBoxes.forEach(box => {
        console.log(`   ☑️  ${box.name} - ${box.description}`);
      });
    }
    console.log('');

    // Verify expected results
    console.log('📊 VERIFICATION:');
    console.log('-'.repeat(80));
    
    const expectedToBeChecked = [
      // Principal
      { name: 'Check Box106', reason: 'Principal medical observation = YES' },
      { name: 'Check Box119', reason: 'Principal medications = NO' },
      { name: 'Check Box131', reason: 'Principal surgery = NO' },
      { name: 'Check Box142', reason: 'Principal blood tests = YES' },
      // Dependent 1
      { name: 'Check Box109', reason: 'Dependent 1 medical observation = NO' },
      { name: 'Check Box120', reason: 'Dependent 1 medications = YES' },
      { name: 'Check Box133', reason: 'Dependent 1 surgery = NO' },
      { name: 'Check Box145', reason: 'Dependent 1 blood tests = NO' },
      // Individual
      { name: 'Check Box70', reason: 'Heart Disease = NO' },
      { name: 'Check Box72', reason: 'High Blood Pressure = YES' },
      { name: 'Check Box68', reason: 'Family member not applied = NO' }
    ];

    const shouldNotBeChecked = [
      // Dependents 2-5 (all table checkboxes for these)
      'Check Box110', 'Check Box111', // Dep 2 medical observation
      'Check Box112', 'Check Box113', // Dep 3 medical observation
      'Check Box114', 'Check Box115', // Dep 4 medical observation
      'Check Box116', 'Check Box117', // Dep 5 medical observation
      'Check Box122', 'Check Box123', // Dep 2 medications
      'Check Box124', 'Check Box125', // Dep 3 medications
      'Check Box126', 'Check Box127', // Dep 4 medications
      'Check Box128', 'Check Box129', // Dep 5 medications
      'Check Box134', 'Check Box135', // Dep 2 surgery
      'Check Box136', 'Check Box137', // Dep 3 surgery
      'Check Box138', 'Check Box139', // Dep 4 surgery
      'Check Box140', 'Check Box141', // Dep 5 surgery
      'Check Box146', 'Check Box147', // Dep 2 blood tests
      'Check Box148', 'Check Box149', // Dep 3 blood tests
      'Check Box150', 'Check Box151', // Dep 4 blood tests
      'Check Box152', 'Check Box153'  // Dep 5 blood tests
    ];

    let passed = 0;
    let failed = 0;

    // Check expected checkboxes
    console.log('');
    console.log('Expected to be CHECKED:');
    for (const expected of expectedToBeChecked) {
      const checkbox = checkedBoxes.find(cb => cb.name === expected.name);
      if (checkbox) {
        console.log(`   ✅ ${expected.name} - ${expected.reason}`);
        passed++;
      } else {
        console.log(`   ❌ ${expected.name} - ${expected.reason} - NOT CHECKED!`);
        failed++;
      }
    }

    // Check that dependents 2-5 are NOT checked
    console.log('');
    console.log('Expected to be UNCHECKED (Dependents 2-5):');
    let dep25Correct = 0;
    let dep25Wrong = 0;
    
    for (const boxName of shouldNotBeChecked) {
      const isChecked = checkedBoxes.find(cb => cb.name === boxName);
      if (!isChecked) {
        dep25Correct++;
      } else {
        console.log(`   ❌ ${boxName} - Should NOT be checked but IS!`);
        dep25Wrong++;
        failed++;
      }
    }
    
    if (dep25Wrong === 0) {
      console.log(`   ✅ All ${dep25Correct} dependent 2-5 checkboxes are correctly empty`);
      passed += dep25Correct;
    }

    // Summary
    console.log('');
    console.log('═'.repeat(80));
    console.log('📊 TEST SUMMARY:');
    console.log('═'.repeat(80));
    console.log(`   ✅ Passed: ${passed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📦 Total checked boxes: ${checkedBoxes.length}`);
    console.log('');

    if (failed === 0) {
      console.log('🎉 SUCCESS! All checkboxes are correctly filled!');
      console.log('');
      console.log('✅ Verification:');
      console.log('   • Principal column has correct answers');
      console.log('   • Dependent 1 column has correct answers');
      console.log('   • Dependents 2-5 are empty (no checkboxes checked)');
      console.log('   • Individual medical questions are correct');
    } else {
      console.log('⚠️  ISSUES FOUND:');
      console.log('   Some checkboxes are not in the expected state.');
      console.log('   This may indicate:');
      console.log('   1. Checkbox field names in PDF are different');
      console.log('   2. Mapping configuration needs adjustment');
      console.log('   3. PDF generation logic issue');
    }

    console.log('');
    console.log('📋 All Checked Boxes (' + checkedBoxes.length + ' total):');
    console.log('-'.repeat(80));
    checkedBoxes.forEach((box, i) => {
      console.log(`   ${i + 1}. ${box.name}`);
    });

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('');
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

inspectGeneratedPdf();
