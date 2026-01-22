/**
 * PDF Form Field Inspector
 * Inspects the MAF Al Sagr PDF to discover all form fields (checkboxes, text fields, etc.)
 */

const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

async function inspectPdfFields() {
  try {
    // Path to the PDF file
    const pdfPath = path.join(__dirname, '../../../MAF Al Sagr .pdf');
    
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found at:', pdfPath);
      console.log('Please ensure "MAF Al Sagr .pdf" is in the project root directory');
      return;
    }

    console.log('📄 Loading PDF:', pdfPath);
    const pdfBytes = fs.readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    
    console.log(`📊 PDF has ${pdfDoc.getPageCount()} pages\n`);
    
    // Get the form
    const form = pdfDoc.getForm();
    const fields = form.getFields();
    
    console.log(`✅ Found ${fields.length} form fields:\n`);
    console.log('═'.repeat(80));
    
    // Group fields by type
    const fieldsByType = {
      checkboxes: [],
      textFields: [],
      radioButtons: [],
      dropdowns: [],
      others: []
    };
    
    fields.forEach((field, index) => {
      const name = field.getName();
      const type = field.constructor.name;
      
      const fieldInfo = {
        index: index + 1,
        name,
        type
      };
      
      if (type.includes('CheckBox')) {
        const checkbox = form.getCheckBox(name);
        fieldInfo.checked = checkbox.isChecked();
        fieldsByType.checkboxes.push(fieldInfo);
      } else if (type.includes('TextField')) {
        const textField = form.getTextField(name);
        fieldInfo.value = textField.getText() || '(empty)';
        fieldsByType.textFields.push(fieldInfo);
      } else if (type.includes('RadioButton')) {
        fieldsByType.radioButtons.push(fieldInfo);
      } else if (type.includes('Dropdown')) {
        fieldsByType.dropdowns.push(fieldInfo);
      } else {
        fieldsByType.others.push(fieldInfo);
      }
    });
    
    // Print checkboxes
    if (fieldsByType.checkboxes.length > 0) {
      console.log(`\n☑️  CHECKBOXES (${fieldsByType.checkboxes.length}):`);
      console.log('─'.repeat(80));
      fieldsByType.checkboxes.forEach(field => {
        console.log(`${field.index}. ${field.name}`);
        console.log(`   Type: ${field.type}`);
        console.log(`   Currently Checked: ${field.checked}`);
        console.log('');
      });
    }
    
    // Print text fields
    if (fieldsByType.textFields.length > 0) {
      console.log(`\n📝 TEXT FIELDS (${fieldsByType.textFields.length}):`);
      console.log('─'.repeat(80));
      fieldsByType.textFields.forEach(field => {
        console.log(`${field.index}. ${field.name}`);
        console.log(`   Type: ${field.type}`);
        console.log(`   Current Value: ${field.value}`);
        console.log('');
      });
    }
    
    // Print radio buttons
    if (fieldsByType.radioButtons.length > 0) {
      console.log(`\n🔘 RADIO BUTTONS (${fieldsByType.radioButtons.length}):`);
      console.log('─'.repeat(80));
      fieldsByType.radioButtons.forEach(field => {
        console.log(`${field.index}. ${field.name}`);
        console.log(`   Type: ${field.type}`);
        console.log('');
      });
    }
    
    // Print dropdowns
    if (fieldsByType.dropdowns.length > 0) {
      console.log(`\n📋 DROPDOWNS (${fieldsByType.dropdowns.length}):`);
      console.log('─'.repeat(80));
      fieldsByType.dropdowns.forEach(field => {
        console.log(`${field.index}. ${field.name}`);
        console.log(`   Type: ${field.type}`);
        console.log('');
      });
    }
    
    // Print others
    if (fieldsByType.others.length > 0) {
      console.log(`\n❓ OTHER FIELDS (${fieldsByType.others.length}):`);
      console.log('─'.repeat(80));
      fieldsByType.others.forEach(field => {
        console.log(`${field.index}. ${field.name}`);
        console.log(`   Type: ${field.type}`);
        console.log('');
      });
    }
    
    console.log('═'.repeat(80));
    console.log(`\n✅ Inspection complete!`);
    console.log(`\nSummary:`);
    console.log(`  Checkboxes: ${fieldsByType.checkboxes.length}`);
    console.log(`  Text Fields: ${fieldsByType.textFields.length}`);
    console.log(`  Radio Buttons: ${fieldsByType.radioButtons.length}`);
    console.log(`  Dropdowns: ${fieldsByType.dropdowns.length}`);
    console.log(`  Others: ${fieldsByType.others.length}`);
    console.log(`  Total: ${fields.length}`);
    
    // Save to file
    const outputPath = path.join(__dirname, 'pdf-fields-inspection.json');
    const output = {
      pdfName: 'MAF Al Sagr.pdf',
      totalPages: pdfDoc.getPageCount(),
      totalFields: fields.length,
      fieldsByType,
      inspectedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved detailed inspection to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error inspecting PDF:', error.message);
    console.error(error.stack);
  }
}

// Run the inspection
inspectPdfFields().catch(console.error);
