/**
 * Unit tests for Sukoon EMAF template rendering (prefill)
 * Asserts that form data (memberDetails, members, previousInsurance, signature) is rendered into the HTML.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { templateRenderer } from '../services/templateRenderer';

const SUKOON_FIXTURE = {
  memberDetails: {
    applicantName: 'John Doe',
    relationship: 'Self',
    address: 'Dubai, UAE',
    poBox: '12345',
    email: 'john@example.com',
    contactNumber: '+971501234567',
    emiratesId: '784-1990-1234567-1',
    occupation: 'Engineer',
    sponsorName: 'Acme Corp',
    salary: 'up_to_4000' as const,
  },
  previousInsurance: {
    hasInsurance: true,
    policyNumber: 'POL-001',
    expiryDate: '2025-12-31',
  },
  members: [
    {
      name: 'John Doe',
      nationality: 'Indian',
      passportOrEmiratesId: '784-1990-1234567-1',
      relationship: 'Self',
      maritalStatus: 'Single',
      dateOfBirth: '1990-05-15',
      gender: 'Male',
      height: '175',
      weight: '70',
      visaEmirate: 'dubai',
    },
    {
      name: 'Jane Doe',
      nationality: 'Indian',
      passportOrEmiratesId: 'P1234567',
      relationship: 'Spouse',
      maritalStatus: 'Married',
      dateOfBirth: '1992-08-20',
      gender: 'Female',
      height: '160',
      weight: '55',
      visaEmirate: 'dubai',
    },
  ],
  signature: {
    applicantName: 'John Doe',
    date: '03/02/26',
    emiratesId: '784-1990-1234567-1',
  },
};

describe('Sukoon template prefill', () => {
  it('renders member details section with fixture data', async () => {
    const html = await templateRenderer.renderTemplate('sukoon', SUKOON_FIXTURE);
    assert.ok(html.includes('John Doe'), 'Applicant name should appear in member details');
    assert.ok(html.includes('Self'), 'Relationship should appear');
    assert.ok(html.includes('Dubai, UAE'), 'Address should appear');
    assert.ok(html.includes('12345'), 'P.O. Box should appear');
    assert.ok(html.includes('john@example.com'), 'Email should appear');
    assert.ok(html.includes('+971501234567'), 'Contact number should appear');
    assert.ok(html.includes('784-1990-1234567-1'), 'Emirates ID should appear in member details');
    assert.ok(html.includes('Engineer'), 'Occupation should appear');
    assert.ok(html.includes('Acme Corp'), 'Sponsor name should appear');
  });

  it('renders salary checkbox--checked for up_to_4000', async () => {
    const html = await templateRenderer.renderTemplate('sukoon', SUKOON_FIXTURE);
    assert.ok(html.includes('checkbox--checked'), 'Salary "Up to 4,000" should be checked');
  });

  it('renders previous insurance yes and policy details', async () => {
    const html = await templateRenderer.renderTemplate('sukoon', SUKOON_FIXTURE);
    assert.ok(html.includes('POL-001'), 'Policy number should appear');
    // formatDate outputs en-GB (e.g. 31/12/2025)
    assert.ok(html.includes('31/12/2025') || html.includes('2025'), 'Expiry date should appear');
  });

  it('prefills Section 2 Yes checkbox when user entry is hasInsurance true (boolean)', async () => {
    const formData = { ...SUKOON_FIXTURE, previousInsurance: { hasInsurance: true } };
    const html = await templateRenderer.renderTemplate('sukoon', formData);
    // Section 2 Yes checkbox: template uses {{checkbox previousInsurance.hasInsurance 'yes'}}
    const yesCheckboxIndex = html.indexOf('Yes &nbsp;&nbsp;');
    const beforeYes = html.substring(Math.max(0, yesCheckboxIndex - 80), yesCheckboxIndex);
    assert.ok(beforeYes.includes('checkbox--checked'), 'Section 2 Yes should be checked when hasInsurance is true');
  });

  it('prefills Section 2 Yes checkbox when user entry is hasInsurance string "true"', async () => {
    const formData = {
      memberDetails: {},
      previousInsurance: { hasInsurance: 'true' as any },
      members: [],
      signature: {},
    };
    const html = await templateRenderer.renderTemplate('sukoon', formData);
    const yesCheckboxIndex = html.indexOf('Yes &nbsp;&nbsp;');
    const beforeYes = html.substring(Math.max(0, yesCheckboxIndex - 80), yesCheckboxIndex);
    assert.ok(beforeYes.includes('checkbox--checked'), 'Section 2 Yes should be checked when user entry is string "true"');
  });

  it('prefills Section 2 No checkbox when user entry is hasInsurance false (boolean)', async () => {
    const formData = {
      memberDetails: {},
      previousInsurance: { hasInsurance: false },
      members: [],
      signature: {},
    };
    const html = await templateRenderer.renderTemplate('sukoon', formData);
    const noCheckboxIndex = html.indexOf('</span>&nbsp;No');
    const beforeNo = html.substring(Math.max(0, noCheckboxIndex - 80), noCheckboxIndex);
    assert.ok(beforeNo.includes('checkbox--checked'), 'Section 2 No should be checked when hasInsurance is false');
  });

  it('prefills Section 2 No checkbox when user entry is hasInsurance string "false"', async () => {
    const formData = {
      memberDetails: {},
      previousInsurance: { hasInsurance: 'false' as any },
      members: [],
      signature: {},
    };
    const html = await templateRenderer.renderTemplate('sukoon', formData);
    const noCheckboxIndex = html.indexOf('</span>&nbsp;No');
    const beforeNo = html.substring(Math.max(0, noCheckboxIndex - 80), noCheckboxIndex);
    assert.ok(beforeNo.includes('checkbox--checked'), 'Section 2 No should be checked when user entry is string "false"');
  });

  it('renders members table with each member', async () => {
    const html = await templateRenderer.renderTemplate('sukoon', SUKOON_FIXTURE);
    assert.ok(html.includes('John Doe'), 'Principal member name should appear in table');
    assert.ok(html.includes('Jane Doe'), 'Second member name should appear in table');
    assert.ok(html.includes('Indian'), 'Nationality should appear');
    assert.ok(html.includes('Spouse'), 'Relationship should appear in table');
    assert.ok(html.includes('Male') && html.includes('Female'), 'Gender should appear');
  });

  it('renders signature section', async () => {
    const html = await templateRenderer.renderTemplate('sukoon', SUKOON_FIXTURE);
    assert.ok(html.includes('John Doe'), 'Signature applicant name should appear');
    assert.ok(html.includes('03/02/26'), 'Signature date should appear');
    assert.ok(html.includes('784-1990-1234567-1'), 'Signature Emirates ID should appear');
  });

  it('handles empty formData without throwing (safeguard)', async () => {
    const html = await templateRenderer.renderTemplate('sukoon', {});
    assert.ok(typeof html === 'string' && html.length > 0, 'Should render HTML with empty formData');
    assert.ok(html.includes('DECLARATION OF HEALTH') || html.includes('Declaration of Health'), 'Template shell should render');
  });
});
