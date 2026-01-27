/**
 * Seed Sukoon EMAF Template
 * Creates the Sukoon template with all questions from their medical application form
 */

import { readFileSync } from 'fs';
import { join } from 'path';

// Load environment variables from local.settings.json
// From dist/src/scripts/, go up 3 levels to reach emaf-service root
const settingsPath = join(__dirname, '../../../local.settings.json');
const settings = JSON.parse(readFileSync(settingsPath, 'utf-8'));
Object.assign(process.env, settings.Values);

import { cosmosService } from '../services/cosmosService';
import { sukoonTemplateSections, sukoonDocumentRequirements } from '../data/sukoon-template-seed';
import { EmafTemplate } from '../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

async function seedSukoonTemplate() {
  console.log('🌱 Starting Sukoon EMAF Template Seeding...');
  
  try {
    // Sukoon vendor details (matching the quotation-generation-service vendor IDs)
    const vendorId = 'vendor-sukoon'; // Must match vendor ID from quotation generation service
    const vendorCode = 'sukoon';
    const vendorName = 'Sukoon Insurance PJSC';
    const createdBy = 'system-seed';

    console.log(`📋 Creating template for ${vendorName}...`);

    // Check if template already exists
    console.log('🔍 Checking for existing template...');
    const existing = await cosmosService.getEmafTemplateByVendor(vendorId);
    
    if (existing && existing.status !== 'archived') {
      console.log('⚠️  Template already exists for Sukoon. Archiving old template...');
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
      name: 'Medical Application Form - Sukoon Insurance PJSC',
      description: 'Comprehensive medical application form for individual and family health insurance coverage. Declaration of Health - Medical Application Form.',
      sections: sukoonTemplateSections,
      requiredDocuments: sukoonDocumentRequirements,
      pdfFieldMappings: [], // Not needed for HTML template approach
      templateType: 'html', // Using HTML template approach
      htmlTemplatePath: 'vendors/sukoon-emaf.hbs', // Path to Handlebars template
      templateVersion: 'v1.0.0',
      templateUpdatedAt: new Date(),
      templateUpdatedBy: createdBy,
      status: 'draft',
      version: 1,
      createdAt: new Date(),
      createdBy,
      updatedAt: new Date(),
      updatedBy: createdBy,
      isDeleted: false
    };

    const created = await cosmosService.createEmafTemplate(template);

    console.log('✅ Sukoon EMAF Template created successfully!');
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
    console.error('❌ Error seeding Sukoon template:', error);
    throw error;
  }
}

// Run the seed function
seedSukoonTemplate()
  .then(() => {
    console.log('✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
