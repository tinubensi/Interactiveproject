/**
 * Tests for Sukoon Template Seed Data
 * TDD: RED Phase - Tests written before implementation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { sukoonTemplateSections, sukoonDocumentRequirements } from '../../data/sukoon-template-seed';
import { FormQuestion } from '../../models/emafTypes';

describe('Sukoon Template Seed Data', () => {
  it('should have 8 sections', () => {
    assert.strictEqual(sukoonTemplateSections.length, 8, 'Should have exactly 8 sections');
  });

  it('should have sections in correct order', () => {
    sukoonTemplateSections.forEach((section, index) => {
      assert.strictEqual(section.order, index + 1, `Section ${index + 1} should have order ${index + 1}`);
    });
  });

  it('should have Section 1: Member Details with 10 questions', () => {
    const section1 = sukoonTemplateSections.find(s => s.order === 1);
    assert(section1, 'Section 1 should exist');
    assert.strictEqual(section1.title, 'Member Details');
    assert.strictEqual(section1.questions.length, 10, 'Section 1 should have 10 questions');
  });

  it('should have Section 2: Previous Insurance with 3 questions', () => {
    const section2 = sukoonTemplateSections.find(s => s.order === 2);
    assert(section2, 'Section 2 should exist');
    assert.strictEqual(section2.title, 'Details of Existing or Previous Insurance');
    assert.strictEqual(section2.questions.length, 3, 'Section 2 should have 3 questions');
  });

  it('should have Section 3: Members with 10 questions', () => {
    const section3 = sukoonTemplateSections.find(s => s.order === 3);
    assert(section3, 'Section 3 should exist');
    assert(section3.title.includes('Members to be insured'));
    assert.strictEqual(section3.questions.length, 10, 'Section 3 should have 10 questions');
  });

  it('should have Section 4: Medical History with 24 questions', () => {
    const section4 = sukoonTemplateSections.find(s => s.order === 4);
    assert(section4, 'Section 4 should exist');
    assert.strictEqual(section4.title, 'Medical History');
    assert.strictEqual(section4.questions.length, 24, 'Section 4 should have 24 questions');
  });

  it('should have Section 5: Specific Medical History with 36 questions', () => {
    const section5 = sukoonTemplateSections.find(s => s.order === 5);
    assert(section5, 'Section 5 should exist');
    assert.strictEqual(section5.title, 'Specific Medical History');
    assert.strictEqual(section5.questions.length, 36, 'Section 5 should have 36 questions');
  });

  it('should have Section 6: YES Answer Details with 6 questions', () => {
    const section6 = sukoonTemplateSections.find(s => s.order === 6);
    assert(section6, 'Section 6 should exist');
    assert(section6.title.includes('YES'));
    assert.strictEqual(section6.questions.length, 6, 'Section 6 should have 6 questions');
  });

  it('should have Section 7: Data Privacy Notice with 0 questions (read-only)', () => {
    const section7 = sukoonTemplateSections.find(s => s.order === 7);
    assert(section7, 'Section 7 should exist');
    assert(section7.title.includes('Data Privacy'));
    assert.strictEqual(section7.questions.length, 0, 'Section 7 should have 0 questions (read-only)');
  });

  it('should have Section 8: Declaration with 3 questions', () => {
    const section8 = sukoonTemplateSections.find(s => s.order === 8);
    assert(section8, 'Section 8 should exist');
    assert.strictEqual(section8.title, 'Declaration');
    assert.strictEqual(section8.questions.length, 3, 'Section 8 should have 3 questions');
  });

  it('should have unique question IDs', () => {
    const allQuestionIds: string[] = [];
    sukoonTemplateSections.forEach(section => {
      section.questions.forEach(question => {
        assert(!allQuestionIds.includes(question.id), `Duplicate question ID found: ${question.id}`);
        allQuestionIds.push(question.id);
      });
    });
  });

  it('should have unique dataKeys within each section', () => {
    sukoonTemplateSections.forEach(section => {
      const dataKeys: string[] = [];
      section.questions.forEach(question => {
        assert(!dataKeys.includes(question.dataKey), `Duplicate dataKey found in ${section.title}: ${question.dataKey}`);
        dataKeys.push(question.dataKey);
      });
    });
  });

  it('should have questions with valid dataKeys matching template structure', () => {
    const section1 = sukoonTemplateSections.find(s => s.order === 1);
    const applicantNameQuestion = section1?.questions.find(q => q.dataKey === 'memberDetails.applicantName');
    assert(applicantNameQuestion, 'Should have applicantName question with correct dataKey');
    
    const section3 = sukoonTemplateSections.find(s => s.order === 3);
    const memberNameQuestion = section3?.questions.find(q => q.dataKey === 'members[].name');
    assert(memberNameQuestion, 'Should have members[].name question with correct dataKey');
    
    const section4 = sukoonTemplateSections.find(s => s.order === 4);
    const diabetesQuestion = section4?.questions.find(q => q.dataKey === 'medicalHistory.question1.diabetes.has');
    assert(diabetesQuestion, 'Should have diabetes question with correct dataKey');
  });

  it('should have 2 document requirements', () => {
    assert.strictEqual(sukoonDocumentRequirements.length, 2, 'Should have 2 document requirements');
  });

  it('should have required documents marked as required', () => {
    sukoonDocumentRequirements.forEach(doc => {
      assert.strictEqual(doc.required, true, `Document ${doc.label} should be required`);
    });
  });

  it('should have document requirements with valid formats', () => {
    sukoonDocumentRequirements.forEach(doc => {
      assert(Array.isArray(doc.acceptedFormats), `Document ${doc.label} should have acceptedFormats array`);
      assert(doc.acceptedFormats.length > 0, `Document ${doc.label} should have at least one accepted format`);
    });
  });

  it('should have all 36 specific medical history conditions', () => {
    const section5 = sukoonTemplateSections.find(s => s.order === 5);
    assert(section5, 'Section 5 should exist');
    
    // Check that all conditions from 1 to 36 exist
    for (let i = 1; i <= 36; i++) {
      const conditionQuestion: FormQuestion | undefined = section5.questions.find(q => q.dataKey === `specificMedicalHistory.condition${i}`);
      assert(conditionQuestion, `Should have condition${i} question`);
      assert.strictEqual(conditionQuestion.type, 'checkbox', `Condition ${i} should be a checkbox`);
    }
  });

  it('should have medical history questions with correct nested structure', () => {
    const section4 = sukoonTemplateSections.find(s => s.order === 4);
    
    // Check Question 1 structure
    const q1 = section4?.questions.find(q => q.dataKey === 'medicalHistory.question1.hasCondition');
    assert(q1, 'Should have question1.hasCondition');
    
    const q1a = section4?.questions.find(q => q.dataKey === 'medicalHistory.question1.diabetes.has');
    assert(q1a, 'Should have question1.diabetes.has');
    
    const q1ai = section4?.questions.find(q => q.dataKey === 'medicalHistory.question1.diabetes.takingInsulin');
    assert(q1ai, 'Should have question1.diabetes.takingInsulin');
    
    const q1aii = section4?.questions.find(q => q.dataKey === 'medicalHistory.question1.diabetes.hasComplications');
    assert(q1aii, 'Should have question1.diabetes.hasComplications');
  });

  it('should have signature section with correct fields', () => {
    const section8 = sukoonTemplateSections.find(s => s.order === 8);
    assert(section8, 'Section 8 should exist');
    
    const applicantName = section8.questions.find(q => q.dataKey === 'signature.applicantName');
    assert(applicantName, 'Should have signature.applicantName');
    
    const date = section8.questions.find(q => q.dataKey === 'signature.date');
    assert(date, 'Should have signature.date');
    assert.strictEqual(date.type, 'date', 'Signature date should be date type');
    
    const emiratesId = section8.questions.find(q => q.dataKey === 'signature.emiratesId');
    assert(emiratesId, 'Should have signature.emiratesId');
  });
});
