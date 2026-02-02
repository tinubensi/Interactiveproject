/**
 * Script to update form templates with corrected salary range field
 * This adds/updates the monthlySalaryRange field to use portal codes (22, 23, 24)
 * instead of text descriptions
 * 
 * Usage:
 * 1. Set COSMOS_CONNECTION_STRING environment variable
 * 2. Run: npx ts-node update_salary_field.ts
 */

import { CosmosClient } from '@azure/cosmos';

// Load connection string from environment
const connectionString = process.env.COSMOS_CONNECTION_STRING;

if (!connectionString) {
  console.error('❌ Error: COSMOS_CONNECTION_STRING environment variable is not set');
  console.log('   Please set it and try again:');
  console.log('   export COSMOS_CONNECTION_STRING="your-connection-string"');
  process.exit(1);
}

const client = new CosmosClient(connectionString);
const database = client.database('FormDB');
const container = database.container('form-definitions');

// Salary field definition with portal codes
const salaryFieldDefinition = {
  id: "monthlySalaryRange",
  label: "Monthly Salary Range",
  dataKey: "monthlySalaryRange",
  type: "dropdown",
  order: 100, // Adjust based on where it should appear in the form
  placeholder: "Select salary range",
  helperText: "Required for insurance quotation",
  validation: {
    required: false // Optional field
  },
  options: [
    {
      label: "Less than 4,000 AED",
      value: "22"
    },
    {
      label: "4,000 - 12,000 AED",
      value: "23"
    },
    {
      label: "Greater than 12,000 AED",
      value: "24"
    }
  ]
};

async function updateFormTemplates() {
  console.log('🔍 Searching for medical insurance form templates...\n');
  
  try {
    // Query for medical insurance templates (case-insensitive)
    const querySpec = {
      query: "SELECT * FROM c WHERE (LOWER(c.insuranceLine) = @insuranceLine OR c.insuranceLine = @insuranceLineUpper) AND c.isDeleted != true",
      parameters: [
        { name: "@insuranceLine", value: "medical" },
        { name: "@insuranceLineUpper", value: "MEDICAL" }
      ]
    };

    const { resources: templates } = await container.items.query(querySpec).fetchAll();
    
    if (templates.length === 0) {
      console.log('⚠️  No medical insurance templates found');
      return;
    }

    console.log(`✅ Found ${templates.length} medical insurance template(s)\n`);

    for (const template of templates) {
      console.log(`📝 Processing: ${template.name} (${template.templateId})`);
      
      let updated = false;
      let salaryFieldFound = false;

      // Check all sections for salary field
      if (template.sections) {
        for (const section of template.sections) {
          if (section.questions) {
            const salaryFieldIndex = section.questions.findIndex(
              (q: any) => q.dataKey === 'monthlySalaryRange' || q.dataKey === 'salaryRange'
            );

            if (salaryFieldIndex >= 0) {
              // Update existing field
              salaryFieldFound = true;
              const oldField = section.questions[salaryFieldIndex];
              console.log(`   🔄 Updating existing salary field in section "${section.title}"`);
              console.log(`      Old options: ${JSON.stringify(oldField.options?.map((o: any) => o.value))}`);
              
              section.questions[salaryFieldIndex] = {
                ...salaryFieldDefinition,
                order: oldField.order // Keep existing order
              };
              
              updated = true;
              console.log(`      New options: ${JSON.stringify(salaryFieldDefinition.options.map(o => o.value))}`);
            }
          }
        }
      }

      // If not found, add to medical details section or create new section
      if (!salaryFieldFound) {
        console.log(`   ➕ Adding new salary field`);
        
        // Try to find medical details section
        const medicalSection = template.sections?.find(
          (s: any) => s.id === 'medical-details' || s.title.toLowerCase().includes('medical')
        );

        if (medicalSection) {
          if (!medicalSection.questions) {
            medicalSection.questions = [];
          }
          const maxOrder = Math.max(...medicalSection.questions.map((q: any) => q.order || 0), 0);
          medicalSection.questions.push({
            ...salaryFieldDefinition,
            order: maxOrder + 1
          });
          updated = true;
          console.log(`      Added to section: ${medicalSection.title}`);
        } else {
          console.log(`      ⚠️  No suitable section found, skipping`);
        }
      }

      if (updated) {
        // Update metadata
        template.updatedAt = new Date().toISOString();
        template.updatedBy = 'system:salary-field-update';

        // Upsert to Cosmos DB
        await container.items.upsert(template);
        console.log(`   ✅ Template updated successfully\n`);
      } else {
        console.log(`   ⏭️  No changes needed\n`);
      }
    }

    console.log('🎉 All templates processed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating templates:', error);
    process.exit(1);
  }
}

// Run the update
updateFormTemplates();
