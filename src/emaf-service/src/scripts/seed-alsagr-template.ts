/**
 * Seed Al Sagr EMAF Template
 * Creates the Al Sagr template with all questions from their medical application form
 */

import { cosmosService } from '../services/cosmosService';
import { alSagrTemplateSections, alSagrDocumentRequirements } from '../data/alsagr-template-seed';
import { EmafTemplate } from '../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

async function seedAlSagrTemplate() {
  console.log('🌱 Starting Al Sagr EMAF Template Seeding...');
  
  try {
    // Al Sagr vendor details (matching the quotation-generation-service vendor IDs)
    const vendorId = 'vendor-alsagr'; // Must match vendor ID from quotation generation service
    const vendorCode = 'ALSAGR';
    const vendorName = 'Al Sagr National Insurance';
    const createdBy = 'system-seed';

    console.log(`📋 Creating template for ${vendorName}...`);

    // Check if template already exists
    console.log('🔍 Checking for existing template...');
    const existing = await cosmosService.getEmafTemplateByVendor(vendorId);
    
    if (existing && existing.status !== 'archived') {
      console.log('⚠️  Template already exists for Al Sagr. Archiving old template...');
      await cosmosService.updateEmafTemplate(existing.id, vendorId, {
        status: 'archived',
        updatedAt: new Date(),
        updatedBy: createdBy
      });
    }

    // Create new template
    const template: EmafTemplate = {
      id: uuidv4(),
      emafId: `emaf-${vendorCode}-${Date.now()}`,
      vendorId,
      vendorCode,
      vendorName,
      lineOfBusiness: 'medical',
      name: 'Medical Application Form - Al Sagr National Insurance',
      description: 'Comprehensive medical application form for individual and family health insurance coverage. Extracted from Al Sagr official EMAF PDF.',
      sections: alSagrTemplateSections,
      requiredDocuments: alSagrDocumentRequirements,
      pdfFieldMappings: [], // Not needed for direct download approach
      vendorPdfBlobPath: 'vendor-pdfs/alsagr-emaf-original.pdf', // Path to original vendor PDF in blob storage
      templateType: 'html', // Using HTML template approach
      htmlTemplatePath: 'vendors/alsagr-emaf.hbs', // Path to Handlebars template
      templateVersion: 'v1.0.0',
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      createdBy,
      updatedAt: new Date(),
      updatedBy: createdBy,
      isDeleted: false
    };

    const created = await cosmosService.createEmafTemplate(template);

    console.log('✅ Al Sagr EMAF Template created successfully!');
    console.log(`📄 Template ID: ${created.id}`);
    console.log(`🆔 EMAF ID: ${created.emafId}`);
    console.log(`📊 Sections: ${template.sections.length}`);
    console.log(`❓ Total Questions: ${template.sections.reduce((sum: number, s) => sum + s.questions.length, 0)}`);
    console.log(`📎 Document Requirements: ${template.requiredDocuments.length}`);
    console.log('');
    console.log('📋 Section Summary:');
    template.sections.forEach((section, idx: number) => {
      console.log(`  ${idx + 1}. ${section.title} - ${section.questions.length} questions`);
    });
    console.log('');
    console.log('📎 Required Documents:');
    template.requiredDocuments.forEach((doc, idx: number) => {
      const reqLabel = doc.required ? '(Required)' : '(Optional)';
      console.log(`  ${idx + 1}. ${doc.label} ${reqLabel}`);
    });
    console.log('');
    
    // Auto-publish the template
    console.log('📤 Publishing template...');
    await cosmosService.updateEmafTemplate(created.id, vendorId, {
      status: 'published',
      publishedAt: new Date(),
      publishedBy: createdBy,
      updatedAt: new Date(),
      updatedBy: createdBy
    });
    console.log('✅ Template published successfully!');
    console.log('');
    console.log('🎯 Template is now active and ready to use!');
    console.log('');
    console.log('🌟 Seeding completed successfully!');

  } catch (error) {
    console.error('❌ Error seeding Al Sagr template:', error);
    throw error;
  }
}

// Run the seed function
seedAlSagrTemplate()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
