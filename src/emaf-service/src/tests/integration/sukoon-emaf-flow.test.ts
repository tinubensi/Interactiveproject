/**
 * End-to-End Integration Tests for Sukoon EMAF Flow
 * TDD: RED Phase - Tests written before implementation
 * 
 * Tests the complete flow:
 * 1. Template registration
 * 2. Form data submission
 * 3. PDF generation
 * 4. Document upload
 * 5. Form submission
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { cosmosService } from '../../services/cosmosService';
import { pdfGeneratorService } from '../../services/pdfGeneratorService';
import { templateRenderer } from '../../services/templateRenderer';
import { sukoonTemplateSections, sukoonDocumentRequirements } from '../../data/sukoon-template-seed';
import { EmafTemplate, EmafSubmission } from '../../models/emafTypes';
import { v4 as uuidv4 } from 'uuid';

describe('Sukoon EMAF End-to-End Integration', () => {
  const vendorId = 'vendor-sukoon';
  const vendorCode = 'sukoon';
  let testTemplate: EmafTemplate;
  let testSubmission: EmafSubmission;

  before(async () => {
    // Verify template exists in database or create test template
    const existing = await cosmosService.getEmafTemplateByVendor(vendorId);
    
    if (existing) {
      testTemplate = existing;
    } else {
      // Create test template
      testTemplate = {
        id: uuidv4(),
        emafId: `emaf-test-${Date.now()}`,
        vendorId,
        vendorCode,
        vendorName: 'Sukoon Insurance PJSC',
        lineOfBusiness: 'medical',
        name: 'Test Sukoon EMAF Template',
        description: 'Test template for integration tests',
        sections: sukoonTemplateSections,
        requiredDocuments: sukoonDocumentRequirements,
        pdfFieldMappings: [],
        templateType: 'html',
        htmlTemplatePath: 'vendors/sukoon-emaf.hbs',
        templateVersion: 'v1.0.0',
        status: 'published',
        version: 1,
        createdAt: new Date(),
        createdBy: 'test',
        updatedAt: new Date(),
        updatedBy: 'test',
        isDeleted: false
      };
      
      testTemplate = await cosmosService.createEmafTemplate(testTemplate);
    }

    // Verify template file exists
    const templateExists = templateRenderer.templateExists(vendorCode);
    assert(templateExists, `Template file for ${vendorCode} must exist`);
  });

  after(async () => {
    // Cleanup: Close browser if needed
    await pdfGeneratorService.closeBrowser();
  });

  it('should create EMAF submission with form data', async () => {
    const leadId = `test-lead-${Date.now()}`;
    const submissionId = uuidv4();
    
    const submission: EmafSubmission = {
      id: submissionId,
      submissionId,
      leadId,
      quotationId: `test-quotation-${Date.now()}`,
      selectedPlanId: `test-plan-${Date.now()}`,
      vendorId,
      vendorCode,
      vendorName: 'Sukoon Insurance PJSC',
      emafTemplateId: testTemplate.id,
      emafVersion: testTemplate.version,
      customerId: `test-customer-${Date.now()}`,
      customerName: 'John Doe',
      customerEmail: 'john.doe@example.com',
      customerPhone: '+971501234567',
      formData: {
        memberDetails: {
          applicantName: 'John Doe',
          relationship: 'Self',
          address: '123 Main Street, Dubai',
          poBox: '12345',
          email: 'john.doe@example.com',
          contactNumber: '+971501234567',
          emiratesId: '784-1990-1234567-1',
          occupation: 'Engineer',
          sponsorName: 'ABC Company',
          salary: 'above_4000'
        },
        previousInsurance: {
          hasInsurance: false
        },
        members: [
          {
            name: 'John Doe',
            nationality: 'American',
            passportOrEmiratesId: '784-1990-1234567-1',
            relationship: 'Self',
            maritalStatus: 'Married',
            dateOfBirth: '15/05/1990',
            gender: 'Male',
            height: '175',
            weight: '75',
            visaEmirate: 'Dubai'
          }
        ],
        medicalHistory: {
          question1: {
            hasCondition: false,
            diabetes: { has: false },
            hypertension: { has: false },
            thyroid: { has: false },
            asthma: { has: false }
          },
          question2: {
            isPregnant: false
          },
          question3: { hasLumpCystCancer: false },
          question4: { hasSurgery: false },
          question5: { hasMedications: false },
          question6: { hasBackPain: false }
        },
        specificMedicalHistory: {},
        yesAnswerDetails: [],
        signature: {
          applicantName: 'John Doe',
          date: '27/01/26',
          emiratesId: '784-1990-1234567-1'
        }
      },
      uploadedDocuments: [],
      status: 'draft',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    testSubmission = await cosmosService.createSubmission(submission);
    
    assert(testSubmission.id === submissionId, 'Submission ID should match');
    assert(testSubmission.formData.memberDetails.applicantName === 'John Doe', 'Form data should be saved');
  });

  it('should render HTML template with submission form data', async () => {
    const html = await templateRenderer.renderTemplate(
      vendorCode,
      testSubmission.formData
    );
    
    assert(html.length > 0, 'HTML should not be empty');
    assert(html.includes('John Doe'), 'Should include applicant name');
    assert(html.includes('john.doe@example.com'), 'Should include email');
    assert(html.includes('<!DOCTYPE html>'), 'Should be valid HTML');
  });

  it('should generate PDF from submission and template', async () => {
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      testSubmission,
      testTemplate
    );
    
    assert(Buffer.isBuffer(pdfBuffer), 'Should return a Buffer');
    assert(pdfBuffer.length > 0, 'PDF should not be empty');
    
    // Verify PDF format
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    assert.strictEqual(pdfHeader, '%PDF', 'Should be valid PDF format');
  });

  it('should handle submission with YES answers and generate PDF', async () => {
    const yesAnswerSubmission: EmafSubmission = {
      ...testSubmission,
      id: uuidv4(),
      submissionId: uuidv4(),
      formData: {
        ...testSubmission.formData,
        medicalHistory: {
          question1: {
            hasCondition: true,
            diabetes: {
              has: true,
              takingInsulin: false,
              hasComplications: false
            },
            hypertension: { has: false },
            thyroid: { has: false },
            asthma: { has: false }
          },
          question2: { isPregnant: false },
          question3: { hasLumpCystCancer: false },
          question4: { hasSurgery: false },
          question5: { hasMedications: false },
          question6: { hasBackPain: false }
        },
        yesAnswerDetails: [
          {
            memberName: 'John Doe',
            questionNumber: '1.a',
            medicalCondition: 'Diabetes',
            dateOfOnset: '01/01/2020',
            treatmentDetails: 'Insulin therapy',
            hospitalClinic: 'Dubai Hospital'
          }
        ]
      }
    };
    
    const html = await templateRenderer.renderTemplate(
      vendorCode,
      yesAnswerSubmission.formData
    );
    
    assert(html.includes('Diabetes'), 'Should include medical condition');
    assert(html.includes('1.a'), 'Should include question number');
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      yesAnswerSubmission,
      testTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with YES answers');
  });

  it('should handle submission with maximum members (7) and generate PDF', async () => {
    const maxMembersSubmission: EmafSubmission = {
      ...testSubmission,
      id: uuidv4(),
      submissionId: uuidv4(),
      formData: {
        ...testSubmission.formData,
        members: Array.from({ length: 7 }, (_, i) => ({
          name: `Member ${i + 1}`,
          nationality: 'American',
          passportOrEmiratesId: `784-1990-123456${i}-1`,
          relationship: i === 0 ? 'Self' : 'Dependent',
          maritalStatus: 'Married',
          dateOfBirth: '15/05/1990',
          gender: 'Male',
          height: '175',
          weight: '75',
          visaEmirate: 'Dubai'
        }))
      }
    };
    
    const html = await templateRenderer.renderTemplate(
      vendorCode,
      maxMembersSubmission.formData
    );
    
    assert(html.includes('Member 7'), 'Should include all 7 members');
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      maxMembersSubmission,
      testTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with maximum members');
  });

  it('should handle submission with previous insurance and generate PDF', async () => {
    const insuranceSubmission: EmafSubmission = {
      ...testSubmission,
      id: uuidv4(),
      submissionId: uuidv4(),
      formData: {
        ...testSubmission.formData,
        previousInsurance: {
          hasInsurance: true,
          policyNumber: 'POL-12345',
          expiryDate: '31/12/2024'
        }
      }
    };
    
    const html = await templateRenderer.renderTemplate(
      vendorCode,
      insuranceSubmission.formData
    );
    
    assert(html.includes('POL-12345'), 'Should include policy number');
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      insuranceSubmission,
      testTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with insurance details');
  });

  it('should validate template structure matches form data structure', () => {
    // Verify all required sections exist
    const sectionTitles = testTemplate.sections.map(s => s.title);
    assert(sectionTitles.includes('Member Details'), 'Should have Member Details section');
    assert(sectionTitles.includes('Details of Existing or Previous Insurance'), 'Should have Previous Insurance section');
    assert(sectionTitles.includes('Members to be insured'), 'Should have Members section');
    assert(sectionTitles.includes('Medical History'), 'Should have Medical History section');
    assert(sectionTitles.includes('Specific Medical History'), 'Should have Specific Medical History section');
    assert(sectionTitles.includes('Declaration'), 'Should have Declaration section');
    
    // Verify form data structure matches template expectations
    assert(testSubmission.formData.memberDetails, 'Form data should have memberDetails');
    assert(testSubmission.formData.members, 'Form data should have members array');
    assert(testSubmission.formData.medicalHistory, 'Form data should have medicalHistory');
    assert(testSubmission.formData.signature, 'Form data should have signature');
  });

  it('should handle date splitting in template rendering', async () => {
    const dateSubmission: EmafSubmission = {
      ...testSubmission,
      id: uuidv4(),
      submissionId: uuidv4(),
      formData: {
        ...testSubmission.formData,
        medicalHistory: {
          ...testSubmission.formData.medicalHistory,
          question2: {
            isPregnant: true,
            expectedDeliveryDate: '25/12/2024'
          }
        },
        signature: {
          ...testSubmission.formData.signature,
          date: '27/01/26'
        }
      }
    };
    
    const html = await templateRenderer.renderTemplate(
      vendorCode,
      dateSubmission.formData
    );
    
    // Check that date boxes are rendered
    assert(html.includes('date-box'), 'Should include date boxes for split dates');
  });

  it('should complete full workflow: create submission -> generate PDF -> verify', async () => {
    // This test verifies the complete workflow
    const workflowSubmission: EmafSubmission = {
      ...testSubmission,
      id: uuidv4(),
      submissionId: uuidv4(),
      formData: {
        memberDetails: {
          applicantName: 'Jane Smith',
          relationship: 'Self',
          address: '456 Business Bay, Dubai',
          email: 'jane.smith@example.com',
          contactNumber: '+971501111111',
          emiratesId: '784-1990-9999999-1',
          salary: 'up_to_4000'
        },
        previousInsurance: {
          hasInsurance: false
        },
        members: [
          {
            name: 'Jane Smith',
            nationality: 'British',
            passportOrEmiratesId: '784-1990-9999999-1',
            relationship: 'Self',
            maritalStatus: 'Single',
            dateOfBirth: '20/06/1995',
            gender: 'Female',
            visaEmirate: 'Dubai'
          }
        ],
        medicalHistory: {
          question1: { hasCondition: false },
          question2: { isPregnant: false },
          question3: { hasLumpCystCancer: false },
          question4: { hasSurgery: false },
          question5: { hasMedications: false },
          question6: { hasBackPain: false }
        },
        specificMedicalHistory: {},
        yesAnswerDetails: [],
        signature: {
          applicantName: 'Jane Smith',
          date: '27/01/26',
          emiratesId: '784-1990-9999999-1'
        }
      }
    };
    
    // Step 1: Render HTML
    const html = await templateRenderer.renderTemplate(
      vendorCode,
      workflowSubmission.formData
    );
    assert(html.length > 0, 'HTML should render');
    
    // Step 2: Generate PDF
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      workflowSubmission,
      testTemplate
    );
    assert(pdfBuffer.length > 0, 'PDF should generate');
    
    // Step 3: Verify PDF format
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    assert.strictEqual(pdfHeader, '%PDF', 'Should be valid PDF');
    
    console.log('✅ Complete workflow test passed');
  });
});
