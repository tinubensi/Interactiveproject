import { CosmosClient } from '@azure/cosmos';

const cosmosEndpoint = process.env.COSMOS_ENDPOINT || 'https://form-service-cchvangsfpfdb3ha.uaenorth-01.azurewebsites.net';
const cosmosKey = process.env.COSMOS_KEY || '';

const client = new CosmosClient({ endpoint: cosmosEndpoint, key: cosmosKey });
const database = client.database('FormDB');
const container = database.container('formtemplates');

const formData = {
  "templateId": "medical-individual-form-v2",
  "name": "Medical Insurance - Individual",
  "description": "Individual health insurance form for UAE residents",
  "insuranceLine": "MEDICAL",
  "organizationId": "individual",
  "businessType": "individual",
  "status": "completed",
  "version": 2,
  "sections": [
    {
      "id": "personal-info",
      "title": "Personal Information",
      "order": 1,
      "questions": [
        { "id": "firstName", "label": "First Name", "dataKey": "firstName", "type": "text", "order": 1, "validation": { "required": true } },
        { "id": "lastName", "label": "Last Name", "dataKey": "lastName", "type": "text", "order": 2, "validation": { "required": true } },
        { "id": "email", "label": "Email", "dataKey": "email", "type": "email", "order": 3, "validation": { "required": true } },
        { "id": "phone", "label": "Phone", "dataKey": "phone", "type": "text", "order": 4, "validation": { "required": true } },
        { "id": "emirate", "label": "Emirate", "dataKey": "emirate", "type": "dropdown", "order": 5, "validation": { "required": true }, "options": [{"label":"Dubai","value":"Dubai"}] }
      ]
    },
    {
      "id": "medical-details",
      "title": "Medical Insurance Details",
      "order": 2,
      "questions": [
        { "id": "dateOfBirth", "label": "Date of Birth", "dataKey": "dateOfBirth", "type": "date", "order": 1, "validation": { "required": true } },
        { "id": "gender", "label": "Gender", "dataKey": "gender", "type": "dropdown", "order": 2, "validation": { "required": true }, "options": [{"label":"Male","value":"Male"},{"label":"Female","value":"Female"}] },
        { "id": "nationality", "label": "Nationality", "dataKey": "nationality", "type": "dropdown", "order": 3, "validation": { "required": true }, "options": [{"label":"UAE","value":"United Arab Emirates"}] }
      ]
    }
  ],
  "questionsWithoutSection": [],
  "connectors": [],
  "createdAt": new Date().toISOString(),
  "updatedAt": new Date().toISOString(),
  "updatedBy": "system",
  "isDeleted": false
};

async function updateForm() {
  try {
    const { resource } = await container.items.upsert(formData);
    console.log('✅ Form updated successfully!');
    console.log(`   - Sections: ${resource.sections.length}`);
    resource.sections.forEach((s: any) => console.log(`     • ${s.title}: ${s.questions.length} questions`));
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

updateForm();
