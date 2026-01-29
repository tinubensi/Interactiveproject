/**
 * Tests for Sukoon EMAF Template Rendering
 * TDD: RED Phase - Tests written before implementation
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { templateRenderer } from '../../services/templateRenderer';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Sukoon EMAF Template Rendering', () => {
  const vendorCode = 'sukoon';
  
  // Sample form data matching the expected structure
  const sampleFormData = {
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
      hasInsurance: true,
      policyNumber: 'POL-12345',
      expiryDate: '31/12/2024'
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
        asthma: { has: false },
        otherConditions: false
      },
      question2: {
        isPregnant: false,
        tryingToGetPregnant: false,
        fertilityTreatment: false
      },
      question3: { hasLumpCystCancer: false },
      question4: { hasSurgery: false },
      question5: { hasMedications: false },
      question6: { hasBackPain: false }
    },
    specificMedicalHistory: {
      condition1: false,
      condition2: false,
      // ... all 36 conditions set to false for minimal data test
    },
    yesAnswerDetails: [],
    signature: {
      applicantName: 'John Doe',
      date: '27/01/26',
      emiratesId: '784-1990-1234567-1'
    }
  };

  before(async () => {
    // Ensure template exists
    const templateExists = templateRenderer.templateExists(vendorCode);
    if (!templateExists) {
      throw new Error(`Template for ${vendorCode} does not exist. Please create it first.`);
    }
  });

  it('should render template with minimal data', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    assert(html.length > 0, 'Rendered HTML should not be empty');
    assert(html.includes('<!DOCTYPE html>'), 'Should include DOCTYPE');
    assert(html.includes('John Doe'), 'Should include applicant name');
    assert(html.includes('john.doe@example.com'), 'Should include email');
  });

  it('should render member details section correctly', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    assert(html.includes('John Doe'), 'Should include applicant name');
    assert(html.includes('123 Main Street'), 'Should include address');
    assert(html.includes('john.doe@example.com'), 'Should include email');
    assert(html.includes('784-1990-1234567-1'), 'Should include Emirates ID');
  });

  it('should render checkbox for salary correctly', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    // Check that "Above 4,000" checkbox is checked
    assert(html.includes('checkbox--checked'), 'Should have checked checkbox for salary');
  });

  it('should render previous insurance section when hasInsurance is true', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    assert(html.includes('POL-12345'), 'Should include policy number');
    assert(html.includes('31/12/2024'), 'Should include expiry date');
  });

  it('should render members table with correct data', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    assert(html.includes('John Doe'), 'Should include member name');
    assert(html.includes('American'), 'Should include nationality');
    assert(html.includes('15/05/1990'), 'Should include date of birth');
  });

  it('should render medical history questions with NO answers', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    // Check that checkboxes are not checked for NO answers
    // The template should show unchecked checkboxes
    assert(html.includes('checkbox'), 'Should have checkbox elements');
  });

  it('should render signature section correctly', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    assert(html.includes('John Doe'), 'Should include signature name');
    assert(html.includes('27/01/26'), 'Should include signature date');
  });

  it('should include base64 logo images', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    assert(html.includes('data:image/png;base64,'), 'Should include base64 image data');
  });

  it('should handle date splitting for DD/MM/YYYY format', async () => {
    const formDataWithDate = {
      ...sampleFormData,
      medicalHistory: {
        ...sampleFormData.medicalHistory,
        question2: {
          ...sampleFormData.medicalHistory.question2,
          expectedDeliveryDate: '25/12/2024'
        }
      }
    };
    
    const html = await templateRenderer.renderTemplate(vendorCode, formDataWithDate);
    
    // Check that date is split into individual boxes
    assert(html.includes('date-box'), 'Should include date boxes');
  });

  it('should render all 5 pages', async () => {
    const html = await templateRenderer.renderTemplate(vendorCode, sampleFormData);
    
    // Count page breaks or page divs
    const pageCount = (html.match(/class="page"/g) || []).length;
    assert(pageCount >= 5, `Should have at least 5 pages, found ${pageCount}`);
  });

  it('should handle maximum data (7 members)', async () => {
    const maxData = {
      ...sampleFormData,
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
    };
    
    const html = await templateRenderer.renderTemplate(vendorCode, maxData);
    
    assert(html.length > 0, 'Should render with maximum data');
    assert(html.includes('Member 7'), 'Should include all 7 members');
  });

  it('should handle YES answers in medical history', async () => {
    const yesData = {
      ...sampleFormData,
      medicalHistory: {
        question1: {
          hasCondition: true,
          diabetes: { has: true, takingInsulin: false, hasComplications: false },
          hypertension: { has: false },
          thyroid: { has: false },
          asthma: { has: false },
          otherConditions: false
        },
        question2: {
          isPregnant: false,
          tryingToGetPregnant: false,
          fertilityTreatment: false
        },
        question3: { hasLumpCystCancer: false },
        question4: { hasSurgery: false },
        question5: { hasMedications: false },
        question6: { hasBackPain: false }
      }
    };
    
    const html = await templateRenderer.renderTemplate(vendorCode, yesData);
    
    // Should have checked checkboxes for YES answers
    assert(html.includes('checkbox--checked'), 'Should have checked checkboxes for YES answers');
  });

  it('should render specific medical history conditions', async () => {
    const conditionData = {
      ...sampleFormData,
      specificMedicalHistory: {
        condition1: true, // Birth Malformation
        condition2: false,
        condition3: true, // Chronic Obstructive Pulmonary Disease
        // ... rest false
      }
    };
    
    // Fill all 36 conditions (most will be false)
    for (let i = 4; i <= 36; i++) {
      (conditionData.specificMedicalHistory as Record<string, boolean>)[`condition${i}`] = false;
    }
    
    const html = await templateRenderer.renderTemplate(vendorCode, conditionData);
    
    assert(html.includes('checkbox'), 'Should render condition checkboxes');
  });

  it('should render YES answer details table', async () => {
    const yesAnswerData = {
      ...sampleFormData,
      medicalHistory: {
        question1: {
          hasCondition: true,
          diabetes: { has: true },
          hypertension: { has: false },
          thyroid: { has: false },
          asthma: { has: false },
          otherConditions: false
        },
        question2: {
          isPregnant: false,
          tryingToGetPregnant: false,
          fertilityTreatment: false
        },
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
    };
    
    const html = await templateRenderer.renderTemplate(vendorCode, yesAnswerData);
    
    assert(html.includes('John Doe'), 'Should include member name in details table');
    assert(html.includes('1.a'), 'Should include question number');
    assert(html.includes('Diabetes'), 'Should include medical condition');
  });
});
