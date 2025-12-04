/**
 * Test lead fixtures
 */

export interface TestLead {
  leadId?: string;
  customerId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  insuranceLine?: string;
  stage?: string;
  source?: string;
  assignedTo?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export const LEADS: Record<string, TestLead> = {
  motorInsurance: {
    firstName: 'Motor',
    lastName: 'Lead',
    email: 'motor.lead@example.com',
    phone: '+971501234570',
    insuranceLine: 'motor',
    stage: 'new',
    source: 'website',
    notes: 'Interested in comprehensive motor insurance',
  },
  healthInsurance: {
    firstName: 'Health',
    lastName: 'Lead',
    email: 'health.lead@example.com',
    phone: '+971501234571',
    insuranceLine: 'health',
    stage: 'new',
    source: 'referral',
    notes: 'Family health insurance inquiry',
  },
  propertyInsurance: {
    firstName: 'Property',
    lastName: 'Lead',
    email: 'property.lead@example.com',
    phone: '+971501234572',
    insuranceLine: 'property',
    stage: 'contacted',
    source: 'partner',
  },
  qualifiedLead: {
    firstName: 'Qualified',
    lastName: 'Lead',
    email: 'qualified.lead@example.com',
    phone: '+971501234573',
    insuranceLine: 'motor',
    stage: 'qualified',
    source: 'website',
    notes: 'Ready to proceed with quote',
  },
};

export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

export const INSURANCE_LINES = ['motor', 'health', 'property', 'life', 'travel', 'marine', 'pet'];

/**
 * Generate a unique lead for testing
 */
export function generateLead(overrides?: Partial<TestLead>): TestLead {
  const uniqueId = Date.now().toString(36);
  return {
    firstName: `Lead${uniqueId}`,
    lastName: 'Test',
    email: `lead.${uniqueId}@example.com`,
    phone: `+9715013${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`,
    insuranceLine: 'motor',
    stage: 'new',
    source: 'api-test',
    ...overrides,
  };
}

