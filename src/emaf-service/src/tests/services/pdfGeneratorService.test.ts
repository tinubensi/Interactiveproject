/**
 * Tests for PDF Generator Service - Sukoon EMAF
 * TDD: RED Phase - Tests written before implementation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { pdfGeneratorService } from '../../services/pdfGeneratorService';
import { templateRenderer } from '../../services/templateRenderer';
import { EmafTemplate, EmafSubmission } from '../../models/emafTypes';

describe('PDF Generator Service - Sukoon EMAF', () => {
  const vendorId = 'vendor-sukoon';
  const vendorCode = 'sukoon';
  
  const sampleTemplate: Partial<EmafTemplate> = {
    id: 'test-template-id',
    vendorId,
    vendorCode,
    vendorName: 'Sukoon Insurance PJSC',
    templateType: 'html',
    htmlTemplatePath: 'vendors/sukoon-emaf.hbs',
    status: 'published'
  };

  const sampleSubmission: Partial<EmafSubmission> = {
    id: 'test-submission-id',
    submissionId: 'test-submission-id',
    leadId: 'test-lead-id',
    quotationId: 'test-quotation-id',
    selectedPlanId: 'test-plan-id',
    vendorId,
    vendorCode,
    vendorName: 'Sukoon Insurance PJSC',
    emafTemplateId: 'test-template-id',
    customerId: 'test-customer-id',
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
    status: 'draft'
  };

  before(async () => {
    // Verify template exists
    const templateExists = templateRenderer.templateExists(vendorCode);
    if (!templateExists) {
      throw new Error(`Template for ${vendorCode} does not exist. Please create it first.`);
    }
  });

  it('should generate PDF buffer from template and form data', async () => {
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      sampleSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(Buffer.isBuffer(pdfBuffer), 'Should return a Buffer');
    assert(pdfBuffer.length > 0, 'PDF buffer should not be empty');
    assert(pdfBuffer.length > 1000, 'PDF should be substantial size (at least 1KB)');
  });

  it('should generate PDF with minimal form data', async () => {
    const minimalSubmission = {
      ...sampleSubmission,
      formData: {
        memberDetails: {
          applicantName: 'Test User',
          email: 'test@example.com'
        },
        members: [],
        medicalHistory: {},
        signature: {
          applicantName: 'Test User'
        }
      }
    };
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      minimalSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF even with minimal data');
  });

  it('should generate PDF with maximum data (7 members)', async () => {
    const maxSubmission = {
      ...sampleSubmission,
      formData: {
        ...sampleSubmission.formData,
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
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      maxSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with maximum members');
  });

  it('should generate PDF with YES answers in medical history', async () => {
    const yesAnswerSubmission = {
      ...sampleSubmission,
      formData: {
        ...sampleSubmission.formData,
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
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      yesAnswerSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with YES answers');
  });

  it('should generate PDF with previous insurance details', async () => {
    const insuranceSubmission = {
      ...sampleSubmission,
      formData: {
        ...sampleSubmission.formData,
        previousInsurance: {
          hasInsurance: true,
          policyNumber: 'POL-12345',
          expiryDate: '31/12/2024'
        }
      }
    };
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      insuranceSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with insurance details');
  });

  it('should generate PDF with specific medical history conditions', async () => {
    const conditionSubmission = {
      ...sampleSubmission,
      formData: {
        ...sampleSubmission.formData,
        specificMedicalHistory: {
          condition1: true, // Birth Malformation
          condition3: true, // Chronic Obstructive Pulmonary Disease
          condition16: true, // Heart Disease
          // Rest false
        }
      }
    };
    
    // Fill remaining conditions as false
    for (let i = 1; i <= 36; i++) {
      const conditionKey = `condition${i}` as keyof typeof conditionSubmission.formData.specificMedicalHistory;
      if (!conditionSubmission.formData.specificMedicalHistory[conditionKey]) {
        (conditionSubmission.formData.specificMedicalHistory as Record<string, boolean>)[conditionKey] = false;
      }
    }
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      conditionSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with medical conditions');
  });

  it('should handle missing optional fields gracefully', async () => {
    const minimalSubmission = {
      ...sampleSubmission,
      formData: {
        memberDetails: {
          applicantName: 'Test User',
          relationship: 'Self',
          address: 'Test Address',
          email: 'test@example.com',
          contactNumber: '+971501234567',
          emiratesId: '784-1990-1234567-1',
          salary: 'up_to_4000'
        },
        previousInsurance: {
          hasInsurance: false
        },
        members: [
          {
            name: 'Test User',
            nationality: 'American',
            passportOrEmiratesId: '784-1990-1234567-1',
            relationship: 'Self',
            maritalStatus: 'Single',
            dateOfBirth: '01/01/1990',
            gender: 'Male',
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
          applicantName: 'Test User',
          date: '27/01/26',
          emiratesId: '784-1990-1234567-1'
        }
      }
    };
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      minimalSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should handle missing optional fields');
  });

  it('should generate valid PDF format', async () => {
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      sampleSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    // PDF files start with %PDF
    const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
    assert.strictEqual(pdfHeader, '%PDF', 'Should be a valid PDF file');
  });

  it('should generate PDF with pregnancy details', async () => {
    const pregnancySubmission = {
      ...sampleSubmission,
      formData: {
        ...sampleSubmission.formData!,
        medicalHistory: {
          ...sampleSubmission.formData!.medicalHistory,
          question2: {
            isPregnant: true,
            pregnancyType: 'single',
            hasComplications: false,
            expectedDeliveryDate: '25/12/2024'
          }
        }
      }
    };
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      pregnancySubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with pregnancy details');
  });

  it('should generate PDF with multiple YES answer details', async () => {
    const multipleYesSubmission = {
      ...sampleSubmission,
      formData: {
        ...sampleSubmission.formData,
        medicalHistory: {
          question1: {
            hasCondition: true,
            diabetes: { has: true },
            hypertension: { has: true },
            thyroid: { has: false },
            asthma: { has: false }
          },
          question2: { isPregnant: false },
          question3: { hasLumpCystCancer: false },
          question4: { hasSurgery: true },
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
          },
          {
            memberName: 'John Doe',
            questionNumber: '1.b',
            medicalCondition: 'Hypertension',
            dateOfOnset: '01/01/2021',
            treatmentDetails: 'Medication',
            hospitalClinic: 'Al Zahra Hospital'
          },
          {
            memberName: 'John Doe',
            questionNumber: '4',
            medicalCondition: 'Appendectomy',
            dateOfOnset: '15/06/2022',
            treatmentDetails: 'Surgery',
            hospitalClinic: 'American Hospital'
          }
        ]
      }
    };
    
    const pdfBuffer = await pdfGeneratorService.generatePrefilledPdf(
      multipleYesSubmission as EmafSubmission,
      sampleTemplate as EmafTemplate
    );
    
    assert(pdfBuffer.length > 0, 'Should generate PDF with multiple YES answer details');
  });
});
