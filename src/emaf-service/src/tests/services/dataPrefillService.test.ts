/**
 * Tests for Data Pre-fill Service
 * TDD: RED Phase - Tests written before implementation
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { dataPrefillService } from '../../services/dataPrefillService';

describe('Data Pre-fill Service', () => {
  const sampleLeadData = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    phone: {
      number: '501234567',
      countryCode: '+971'
    },
    emirate: 'Dubai',
    lobData: {
      dateOfBirth: '1990-05-15',
      gender: 'Male',
      height: '175',
      weight: '75',
      nationality: 'American',
      emiratesId: '784-1990-1234567-1',
      passportNumber: 'A12345678',
      maritalStatus: 'Married',
      occupation: 'Engineer',
      address: '123 Main Street, Dubai',
      poBox: '12345',
      sponsorName: 'ABC Company',
      salary: '5000'
    }
  };

  it('should pre-fill member details from lead data', () => {
    const { vendorFormat } = dataPrefillService.prefillFromLeadAndEmaf(sampleLeadData);
    
    assert.strictEqual(vendorFormat.memberDetails.applicantName, 'John Doe');
    assert.strictEqual(vendorFormat.memberDetails.email, 'john.doe@example.com');
    assert.strictEqual(vendorFormat.memberDetails.contactNumber, '+971501234567');
    assert.strictEqual(vendorFormat.memberDetails.address, 'Dubai');
    assert.strictEqual(vendorFormat.memberDetails.emiratesId, '784-1990-1234567-1');
    assert.strictEqual(vendorFormat.memberDetails.occupation, 'Engineer');
    assert.strictEqual(vendorFormat.memberDetails.poBox, '12345');
    assert.strictEqual(vendorFormat.memberDetails.sponsorName, 'ABC Company');
  });

  it('should map salary correctly', () => {
    const lowSalaryLead = {
      ...sampleLeadData,
      lobData: {
        ...sampleLeadData.lobData,
        salary: '3500'
      }
    };
    
    const highSalaryLead = {
      ...sampleLeadData,
      lobData: {
        ...sampleLeadData.lobData,
        salary: '8000'
      }
    };
    
    const { vendorFormat: prefilledLow } = dataPrefillService.prefillFromLeadAndEmaf(lowSalaryLead);
    const { vendorFormat: prefilledHigh } = dataPrefillService.prefillFromLeadAndEmaf(highSalaryLead);
    
    assert.strictEqual(prefilledLow.memberDetails.salary, 'up_to_4000');
    assert.strictEqual(prefilledHigh.memberDetails.salary, 'above_4000');
  });

  it('should pre-fill members array from lead data', () => {
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(sampleLeadData);
    
    assert(prefilled.members && prefilled.members.length > 0, 'Should have at least one member');
    assert.strictEqual(prefilled.members[0].name, 'John Doe');
    assert.strictEqual(prefilled.members[0].nationality, 'American');
    assert.strictEqual(prefilled.members[0].passportOrEmiratesId, '784-1990-1234567-1');
    assert.strictEqual(prefilled.members[0].relationship, 'Self');
    assert.strictEqual(prefilled.members[0].maritalStatus, 'Married');
    assert.strictEqual(prefilled.members[0].dateOfBirth, '1990-05-15');
    assert.strictEqual(prefilled.members[0].gender, 'Male');
    assert.strictEqual(prefilled.members[0].height, '175');
    assert.strictEqual(prefilled.members[0].weight, '75');
    assert.strictEqual(prefilled.members[0].visaEmirate, 'Dubai');
  });

  it('should handle missing lead data gracefully', () => {
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(undefined);
    
    assert(prefilled.memberDetails, 'Should have memberDetails object');
    assert(prefilled.members, 'Should have members array');
  });

  it('should handle partial lead data', () => {
    const partialLead = {
      firstName: 'Jane',
      email: 'jane@example.com'
    };
    
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(partialLead);
    
    assert.strictEqual(prefilled.memberDetails.applicantName, 'Jane');
    assert.strictEqual(prefilled.memberDetails.email, 'jane@example.com');
  });

  it('should merge existing EMAF data with lead data', () => {
    const existingEmafData = {
      formData: {
        memberDetails: {
          applicantName: 'Existing Name',
          email: 'existing@example.com'
        },
        medicalHistory: {
          question1: {
            hasCondition: true
          }
        }
      }
    };
    
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(sampleLeadData, existingEmafData);
    
    // Existing data should take precedence
    assert.strictEqual(prefilled.memberDetails.applicantName, 'Existing Name');
    assert.strictEqual(prefilled.memberDetails.email, 'existing@example.com');
    assert(prefilled.medicalHistory?.question1?.hasCondition === true);
  });

  it('should set default relationship to Self', () => {
    const leadWithoutRelationship = {
      firstName: 'Test',
      lastName: 'User'
    };
    
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(leadWithoutRelationship);
    
    assert.strictEqual(prefilled.memberDetails.relationship, 'Self');
  });

  it('should handle phone number with country code', () => {
    const leadWithPhone = {
      phone: {
        number: '501234567',
        countryCode: '+971'
      }
    };
    
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(leadWithPhone);
    
    assert.strictEqual(prefilled.memberDetails.contactNumber, '+971501234567');
  });

  it('should handle phone number without country code', () => {
    const leadWithPhone = {
      phone: {
        number: '501234567'
      }
    };
    
    const { vendorFormat: prefilled } = dataPrefillService.prefillFromLeadAndEmaf(leadWithPhone);
    
    assert.strictEqual(prefilled.memberDetails.contactNumber, '+971501234567');
  });

  it('should pre-fill from multiple sources with customer profile override', () => {
    const customerProfile = {
      name: 'Customer Profile Name',
      email: 'profile@example.com',
      mobileNumber: '+971501111111',
      emiratesId: '784-1990-9999999-1'
    };
    
    const prefilled = dataPrefillService.prefillFromMultipleSources(
      sampleLeadData,
      undefined,
      undefined, // vendorId
      customerProfile
    );
    
    // Customer profile should override lead data
    assert.strictEqual(prefilled.memberDetails.applicantName, 'Customer Profile Name');
    assert.strictEqual(prefilled.memberDetails.email, 'profile@example.com');
    assert.strictEqual(prefilled.memberDetails.contactNumber, '+971501111111');
    assert.strictEqual(prefilled.memberDetails.emiratesId, '784-1990-9999999-1');
  });
});
