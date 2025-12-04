/**
 * Test configuration and service URLs
 */

export interface ServiceConfig {
  name: string;
  url: string;
  port: number;
  healthEndpoint: string;
}

// Default ports from the development plan
const SERVICE_PORTS = {
  authentication: 7071,
  authorization: 7072,
  audit: 7073,
  staffManagement: 7074,
  notification: 7075,
  workflow: 7076,
  customer: 7077,
  lead: 7078,
  form: 7079,
  document: 7080,
  quotation: 7081,
  quotationGeneration: 7082,
  policy: 7083,
};

export const SERVICES: Record<string, ServiceConfig> = {
  authentication: {
    name: 'authentication-service',
    url: process.env.AUTH_SERVICE_URL || `http://localhost:${SERVICE_PORTS.authentication}`,
    port: SERVICE_PORTS.authentication,
    healthEndpoint: '/api/health',
  },
  authorization: {
    name: 'authorization-service',
    url: process.env.AUTHZ_SERVICE_URL || `http://localhost:${SERVICE_PORTS.authorization}`,
    port: SERVICE_PORTS.authorization,
    healthEndpoint: '/api/health',
  },
  audit: {
    name: 'audit-service',
    url: process.env.AUDIT_SERVICE_URL || `http://localhost:${SERVICE_PORTS.audit}`,
    port: SERVICE_PORTS.audit,
    healthEndpoint: '/api/health',
  },
  staffManagement: {
    name: 'staff-management-service',
    url: process.env.STAFF_SERVICE_URL || `http://localhost:${SERVICE_PORTS.staffManagement}`,
    port: SERVICE_PORTS.staffManagement,
    healthEndpoint: '/api/health',
  },
  notification: {
    name: 'notification-service',
    url: process.env.NOTIFICATION_SERVICE_URL || `http://localhost:${SERVICE_PORTS.notification}`,
    port: SERVICE_PORTS.notification,
    healthEndpoint: '/api/health',
  },
  workflow: {
    name: 'workflow-service',
    url: process.env.WORKFLOW_SERVICE_URL || `http://localhost:${SERVICE_PORTS.workflow}`,
    port: SERVICE_PORTS.workflow,
    healthEndpoint: '/api/health',
  },
  customer: {
    name: 'customer-service',
    url: process.env.CUSTOMER_SERVICE_URL || `http://localhost:${SERVICE_PORTS.customer}`,
    port: SERVICE_PORTS.customer,
    healthEndpoint: '/api/health',
  },
  lead: {
    name: 'lead-service',
    url: process.env.LEAD_SERVICE_URL || `http://localhost:${SERVICE_PORTS.lead}`,
    port: SERVICE_PORTS.lead,
    healthEndpoint: '/api/health',
  },
  form: {
    name: 'form-service',
    url: process.env.FORM_SERVICE_URL || `http://localhost:${SERVICE_PORTS.form}`,
    port: SERVICE_PORTS.form,
    healthEndpoint: '/api/health',
  },
  document: {
    name: 'document-service',
    url: process.env.DOCUMENT_SERVICE_URL || `http://localhost:${SERVICE_PORTS.document}`,
    port: SERVICE_PORTS.document,
    healthEndpoint: '/api/health',
  },
  quotation: {
    name: 'quotation-service',
    url: process.env.QUOTATION_SERVICE_URL || `http://localhost:${SERVICE_PORTS.quotation}`,
    port: SERVICE_PORTS.quotation,
    healthEndpoint: '/api/health',
  },
  quotationGeneration: {
    name: 'quotation-generation-service',
    url: process.env.QUOTATION_GEN_SERVICE_URL || `http://localhost:${SERVICE_PORTS.quotationGeneration}`,
    port: SERVICE_PORTS.quotationGeneration,
    healthEndpoint: '/api/health',
  },
  policy: {
    name: 'policy-service',
    url: process.env.POLICY_SERVICE_URL || `http://localhost:${SERVICE_PORTS.policy}`,
    port: SERVICE_PORTS.policy,
    healthEndpoint: '/api/health',
  },
};

export function getServiceUrl(serviceName: keyof typeof SERVICES): string {
  return SERVICES[serviceName].url;
}

export function getServiceUrls(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(SERVICES).map(([key, config]) => [key, config.url])
  );
}

export const TEST_CONFIG = {
  // Internal service key for inter-service communication
  internalServiceKey: process.env.INTERNAL_SERVICE_KEY || 'test-service-key',
  
  // Test user credentials
  testUser: {
    userId: 'test-user-id',
    email: 'test@nectaria.com',
    roles: ['broker'],
  },
  
  // Admin user credentials
  adminUser: {
    userId: 'admin-user-id',
    email: 'admin@nectaria.com',
    roles: ['super-admin'],
  },
  
  // Timeouts
  serviceStartTimeout: 60000,
  requestTimeout: 10000,
};

