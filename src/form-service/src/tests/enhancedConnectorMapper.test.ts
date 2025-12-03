import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeFormDataForConnectors,
  mergePortalAndTemplateMappings,
  getEffectiveMappings
} from '../lib/connectorMapper';
import { FormIntake, FormTemplate, ConnectorConfig } from '../models/formTypes';
import { PortalDefinition } from '../models/portalTypes';

test('mergePortalAndTemplateMappings should combine portal defaults with template overrides', () => {
  const portalDefaults: PortalDefinition['defaultMappings'] = {
    firstName: { targetField: 'first_name' },
    lastName: { targetField: 'last_name' },
    email: { targetField: 'email_address' }
  };

  const templateOverrides: ConnectorConfig['fieldMap'] = {
    email: 'email' // Override email mapping
  };

  const merged = mergePortalAndTemplateMappings(portalDefaults, templateOverrides);
  
  assert.equal(merged.firstName?.targetField, 'first_name');
  assert.equal(merged.lastName?.targetField, 'last_name');
  assert.equal(merged.email?.targetField, 'email'); // Template override wins
});

test('getEffectiveMappings should return portal defaults when no template overrides', () => {
  const portalDefaults: PortalDefinition['defaultMappings'] = {
    firstName: { targetField: 'first_name' }
  };

  const effective = getEffectiveMappings(portalDefaults, {});
  assert.equal(effective.firstName?.targetField, 'first_name');
});

test('normalizeFormDataForConnectors should use portal registry when available', async () => {
  const template: FormTemplate = {
    templateId: 'template-1',
    name: 'Test Template',
    insuranceLine: 'AUTO',
    organizationId: 'org',
    status: 'completed',
    version: 1,
    sections: [],
    connectors: [
      {
        portal: 'carrier-progressive',
        fieldMap: {
          email: 'email' // Override
        }
      }
    ]
  };

  const intake: FormIntake = {
    id: 'intake-1',
    intakeId: 'intake-1',
    templateId: 'template-1',
    insuranceLine: 'AUTO',
    customerId: 'cust-1',
    status: 'draft',
    formDataRaw: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com'
    },
    formDataNormalized: {}
  };

  // Mock portal registry
  const mockPortal: PortalDefinition = {
    portalId: 'carrier-progressive',
    name: 'Progressive',
    fieldDefinitions: {},
    defaultMappings: {
      firstName: { targetField: 'first_name' },
      lastName: { targetField: 'last_name' },
      email: { targetField: 'email_address' }
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const normalized = await normalizeFormDataForConnectors(template, intake, [mockPortal]);
  
  assert.equal(normalized['carrier-progressive'].first_name, 'Jane');
  assert.equal(normalized['carrier-progressive'].last_name, 'Doe');
  assert.equal(normalized['carrier-progressive'].email, 'jane@example.com'); // Template override
});

test('normalizeFormDataForConnectors should apply JSONata transformations', async () => {
  const template: FormTemplate = {
    templateId: 'template-1',
    name: 'Test Template',
    insuranceLine: 'AUTO',
    organizationId: 'org',
    status: 'completed',
    version: 1,
    sections: [],
    connectors: [
      {
        portal: 'carrier-progressive',
        fieldMap: {}
      }
    ]
  };

  const intake: FormIntake = {
    id: 'intake-1',
    intakeId: 'intake-1',
    templateId: 'template-1',
    insuranceLine: 'AUTO',
    customerId: 'cust-1',
    status: 'draft',
    formDataRaw: {
      firstName: 'Jane',
      lastName: 'Doe'
    },
    formDataNormalized: {}
  };

  const mockPortal: PortalDefinition = {
    portalId: 'carrier-progressive',
    name: 'Progressive',
    fieldDefinitions: {},
    defaultMappings: {
      firstName: { targetField: 'first_name' },
      lastName: { targetField: 'last_name' },
      fullName: {
        targetField: 'full_name',
        transformation: 'firstName & " " & lastName'
      }
    },
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const normalized = await normalizeFormDataForConnectors(template, intake, [mockPortal]);
  
  assert.equal(normalized['carrier-progressive'].full_name, 'Jane Doe');
});

test('normalizeFormDataForConnectors should work without portal registry (backward compatible)', async () => {
  const template: FormTemplate = {
    templateId: 'template-1',
    name: 'Test Template',
    insuranceLine: 'AUTO',
    organizationId: 'org',
    status: 'completed',
    version: 1,
    sections: [],
    connectors: [
      {
        portal: 'CarrierA',
        fieldMap: {
          firstName: 'full_name',
          email: 'contact_email'
        },
        transformations: {
          fullName: { type: 'concat', fields: ['firstName', 'lastName'] }
        }
      }
    ]
  };

  const intake: FormIntake = {
    id: 'intake-1',
    intakeId: 'intake-1',
    templateId: 'template-1',
    insuranceLine: 'AUTO',
    customerId: 'cust-1',
    status: 'draft',
    formDataRaw: {
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com'
    },
    formDataNormalized: {}
  };

  const normalized = await normalizeFormDataForConnectors(template, intake);
  
  assert.equal(normalized.CarrierA.full_name, 'Jane');
  assert.equal(normalized.CarrierA.fullName, 'Jane Doe');
  assert.equal(normalized.CarrierA.contact_email, 'jane@example.com');
});

