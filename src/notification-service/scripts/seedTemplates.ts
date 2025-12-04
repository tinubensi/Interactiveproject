/**
 * Seed System Templates
 * Run with: npm run seed:templates
 */

import { CosmosClient } from '@azure/cosmos';
import { CreateTemplateRequest, NotificationTemplateDocument } from '../src/models/NotificationTemplate';
import { v4 as uuidv4 } from 'uuid';

const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT;
const COSMOS_KEY = process.env.COSMOS_KEY;
const DATABASE_ID = process.env.COSMOS_DATABASE_ID || 'notification-db';

/**
 * System templates to seed
 */
const SYSTEM_TEMPLATES: CreateTemplateRequest[] = [
  // Approval Required
  {
    templateId: 'approval_required',
    name: 'Approval Required',
    description: 'Notification sent when a new approval request is created',
    category: 'approval',
    type: 'action_required',
    priority: 'high',
    content: {
      inApp: {
        title: '{{approvalType}} Approval Required',
        message: '{{requesterName}} submitted {{entityType}} for review',
        body: '<p>Please review and take action on this approval request.</p>',
      },
      email: {
        subject: 'Action Required: {{approvalType}} Approval',
        bodyHtml: '<h2>{{approvalType}} Approval Required</h2><p>{{requesterName}} has submitted a {{entityType}} that requires your approval.</p><p><a href="{{actionUrl}}">Review Approval</a></p>',
        bodyText: '{{approvalType}} Approval Required\n\n{{requesterName}} has submitted a {{entityType}} that requires your approval.\n\nReview at: {{actionUrl}}',
      },
      push: {
        title: 'Approval Required',
        body: '{{requesterName}} needs your approval',
      },
    },
    variables: [
      { name: 'approvalType', type: 'string', required: true, description: 'Type of approval (Quote, Policy, etc.)' },
      { name: 'requesterName', type: 'string', required: true, description: 'Name of the person requesting approval' },
      { name: 'entityType', type: 'string', required: true, description: 'Type of entity being approved' },
      { name: 'approvalId', type: 'string', required: true, description: 'ID of the approval request' },
      { name: 'actionUrl', type: 'url', required: false, description: 'URL to review the approval', defaultValue: '/approvals/{{approvalId}}' },
    ],
    action: {
      type: 'link',
      label: 'Review Approval',
      urlTemplate: '/approvals/{{approvalId}}',
    },
    defaultChannels: ['inApp', 'email', 'push'],
  },

  // Approval Reminder
  {
    templateId: 'approval_reminder',
    name: 'Approval Reminder',
    description: 'Reminder for pending approvals',
    category: 'reminder',
    type: 'warning',
    priority: 'normal',
    content: {
      inApp: {
        title: 'Pending Approval Reminder',
        message: '{{approvalType}} from {{requesterName}} has been waiting for {{waitingDays}} days',
      },
      email: {
        subject: 'Reminder: Pending {{approvalType}} Approval',
        bodyHtml: '<h2>Approval Pending</h2><p>A {{approvalType}} approval request from {{requesterName}} has been waiting for {{waitingDays}} days.</p>',
        bodyText: 'Approval Pending\n\nA {{approvalType}} approval request from {{requesterName}} has been waiting for {{waitingDays}} days.',
      },
    },
    variables: [
      { name: 'approvalType', type: 'string', required: true, description: 'Type of approval' },
      { name: 'requesterName', type: 'string', required: true, description: 'Name of requester' },
      { name: 'waitingDays', type: 'number', required: true, description: 'Number of days waiting' },
      { name: 'approvalId', type: 'string', required: true, description: 'Approval ID' },
    ],
    action: {
      type: 'link',
      label: 'Review Now',
      urlTemplate: '/approvals/{{approvalId}}',
    },
    defaultChannels: ['inApp', 'email'],
  },

  // Approval Escalated
  {
    templateId: 'approval_escalated',
    name: 'Approval Escalated',
    description: 'Notification sent when an approval is escalated',
    category: 'approval',
    type: 'warning',
    priority: 'urgent',
    content: {
      inApp: {
        title: 'Approval Escalated',
        message: '{{approvalType}} from {{requesterName}} has been escalated to you',
      },
      email: {
        subject: 'URGENT: Escalated {{approvalType}} Approval',
        bodyHtml: '<h2 style="color:red">Escalated Approval</h2><p>A {{approvalType}} approval request has been escalated to you due to timeout.</p>',
        bodyText: 'URGENT: Escalated Approval\n\nA {{approvalType}} approval request has been escalated to you.',
      },
      sms: {
        message: 'Nectaria URGENT: {{approvalType}} approval escalated. Please review.',
      },
    },
    variables: [
      { name: 'approvalType', type: 'string', required: true, description: 'Type of approval' },
      { name: 'requesterName', type: 'string', required: true, description: 'Original requester' },
      { name: 'approvalId', type: 'string', required: true, description: 'Approval ID' },
    ],
    action: {
      type: 'link',
      label: 'Review Immediately',
      urlTemplate: '/approvals/{{approvalId}}',
    },
    defaultChannels: ['inApp', 'email', 'sms'],
  },

  // Approval Decided
  {
    templateId: 'approval_decided',
    name: 'Approval Decided',
    description: 'Notification sent when an approval decision is made',
    category: 'update',
    type: 'info',
    priority: 'normal',
    content: {
      inApp: {
        title: '{{approvalType}} {{decision}}',
        message: 'Your {{entityType}} has been {{decision}} by {{decidedBy}}',
      },
    },
    variables: [
      { name: 'approvalType', type: 'string', required: true, description: 'Type of approval' },
      { name: 'entityType', type: 'string', required: true, description: 'Entity type' },
      { name: 'decision', type: 'string', required: true, description: 'Decision (Approved/Rejected)' },
      { name: 'decidedBy', type: 'string', required: true, description: 'Person who decided' },
      { name: 'approvalId', type: 'string', required: true, description: 'Approval ID' },
    ],
    action: {
      type: 'link',
      label: 'View Details',
      urlTemplate: '/approvals/{{approvalId}}',
    },
    defaultChannels: ['inApp'],
  },

  // Lead Assigned
  {
    templateId: 'lead_assigned',
    name: 'Lead Assigned',
    description: 'Notification when a new lead is assigned',
    category: 'assignment',
    type: 'info',
    priority: 'normal',
    content: {
      inApp: {
        title: 'New Lead Assigned',
        message: 'You have been assigned a new lead: {{leadName}}',
      },
    },
    variables: [
      { name: 'leadId', type: 'string', required: true, description: 'Lead ID' },
      { name: 'leadName', type: 'string', required: true, description: 'Lead name' },
      { name: 'source', type: 'string', required: false, description: 'Lead source' },
    ],
    action: {
      type: 'link',
      label: 'View Lead',
      urlTemplate: '/leads/{{leadId}}',
    },
    defaultChannels: ['inApp'],
  },

  // Customer Assigned
  {
    templateId: 'customer_assigned',
    name: 'Customer Assigned',
    description: 'Notification when a customer is assigned',
    category: 'assignment',
    type: 'info',
    priority: 'normal',
    content: {
      inApp: {
        title: 'Customer Assigned',
        message: 'You have been assigned customer: {{customerName}}',
      },
    },
    variables: [
      { name: 'customerId', type: 'string', required: true, description: 'Customer ID' },
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
    ],
    action: {
      type: 'link',
      label: 'View Customer',
      urlTemplate: '/customers/{{customerId}}',
    },
    defaultChannels: ['inApp'],
  },

  // Policy Renewal Reminder
  {
    templateId: 'policy_renewal',
    name: 'Policy Renewal Reminder',
    description: 'Reminder for upcoming policy renewals',
    category: 'reminder',
    type: 'warning',
    priority: 'normal',
    content: {
      inApp: {
        title: 'Policy Renewal Due',
        message: "{{customerName}}'s {{policyType}} expires on {{expiryDate}}",
      },
      email: {
        subject: 'Policy Renewal: {{policyNumber}}',
        bodyHtml: '<h2>Policy Renewal Reminder</h2><p>{{customerName}}&apos;s {{policyType}} policy ({{policyNumber}}) expires on {{expiryDate}}.</p>',
        bodyText: 'Policy Renewal Reminder\n\n{{customerName}} policy {{policyNumber}} expires on {{expiryDate}}.',
      },
    },
    variables: [
      { name: 'policyId', type: 'string', required: true, description: 'Policy ID' },
      { name: 'policyNumber', type: 'string', required: true, description: 'Policy number' },
      { name: 'policyType', type: 'string', required: true, description: 'Type of policy' },
      { name: 'customerName', type: 'string', required: true, description: 'Customer name' },
      { name: 'expiryDate', type: 'date', required: true, description: 'Expiry date' },
    ],
    action: {
      type: 'link',
      label: 'View Policy',
      urlTemplate: '/policies/{{policyId}}',
    },
    defaultChannels: ['inApp', 'email'],
  },

  // License Expiring
  {
    templateId: 'license_expiring',
    name: 'License Expiring',
    description: 'Alert for staff license expiration',
    category: 'alert',
    type: 'warning',
    priority: 'high',
    content: {
      inApp: {
        title: 'License Expiring Soon',
        message: 'Your {{licenseType}} license expires in {{daysUntilExpiry}} days',
      },
      email: {
        subject: 'License Expiry Alert: {{licenseType}}',
        bodyHtml: '<h2>License Expiry Alert</h2><p>Your {{licenseType}} license expires on {{expiryDate}} ({{daysUntilExpiry}} days).</p><p>Please arrange for renewal.</p>',
        bodyText: 'License Expiry Alert\n\nYour {{licenseType}} license expires on {{expiryDate}} ({{daysUntilExpiry}} days).\n\nPlease arrange for renewal.',
      },
    },
    variables: [
      { name: 'licenseType', type: 'string', required: true, description: 'Type of license' },
      { name: 'expiryDate', type: 'date', required: true, description: 'Expiry date' },
      { name: 'daysUntilExpiry', type: 'number', required: true, description: 'Days until expiry' },
    ],
    defaultChannels: ['inApp', 'email'],
  },

  // Login Alert
  {
    templateId: 'login_alert',
    name: 'Suspicious Login Alert',
    description: 'Security alert for suspicious login activity',
    category: 'security',
    type: 'warning',
    priority: 'urgent',
    content: {
      inApp: {
        title: 'Security Alert',
        message: 'Unusual login activity detected from {{location}}',
      },
      email: {
        subject: 'Security Alert: Unusual Login Activity',
        bodyHtml: '<h2 style="color:red">Security Alert</h2><p>We detected unusual login activity on your account.</p><p><strong>Location:</strong> {{location}}<br><strong>IP Address:</strong> {{ipAddress}}<br><strong>Device:</strong> {{userAgent}}</p><p>If this wasn&apos;t you, please contact support immediately.</p>',
        bodyText: 'Security Alert\n\nUnusual login activity detected.\n\nLocation: {{location}}\nIP: {{ipAddress}}\nDevice: {{userAgent}}\n\nIf this wasn\'t you, contact support immediately.',
      },
      sms: {
        message: 'Nectaria Security: Unusual login from {{location}}. Contact support if not you.',
      },
    },
    variables: [
      { name: 'location', type: 'string', required: true, description: 'Login location' },
      { name: 'ipAddress', type: 'string', required: true, description: 'IP address' },
      { name: 'userAgent', type: 'string', required: false, description: 'Device/browser info' },
      { name: 'timestamp', type: 'date', required: false, description: 'Time of login' },
    ],
    defaultChannels: ['inApp', 'email', 'sms'],
  },

  // Password Changed
  {
    templateId: 'password_changed',
    name: 'Password Changed',
    description: 'Confirmation of password change',
    category: 'security',
    type: 'info',
    priority: 'high',
    content: {
      inApp: {
        title: 'Password Changed',
        message: 'Your password was successfully changed',
      },
      email: {
        subject: 'Your Password Was Changed',
        bodyHtml: '<h2>Password Changed</h2><p>Your password was changed at {{timestamp}}.</p><p>If you did not make this change, please contact support immediately.</p>',
        bodyText: 'Password Changed\n\nYour password was changed at {{timestamp}}.\n\nIf you did not make this change, please contact support immediately.',
      },
    },
    variables: [
      { name: 'timestamp', type: 'date', required: true, description: 'Time of change' },
    ],
    defaultChannels: ['inApp', 'email'],
  },

  // Role Granted
  {
    templateId: 'role_granted',
    name: 'Role Granted',
    description: 'Notification when a new role is assigned',
    category: 'security',
    type: 'info',
    priority: 'normal',
    content: {
      inApp: {
        title: 'New Role Assigned',
        message: 'You have been granted the {{roleName}} role',
      },
      email: {
        subject: 'New Role Assigned: {{roleName}}',
        bodyHtml: '<h2>New Role Assigned</h2><p>You have been granted the <strong>{{roleName}}</strong> role by {{assignedBy}}.</p>',
        bodyText: 'New Role Assigned\n\nYou have been granted the {{roleName}} role by {{assignedBy}}.',
      },
    },
    variables: [
      { name: 'roleName', type: 'string', required: true, description: 'Name of the role' },
      { name: 'assignedBy', type: 'string', required: true, description: 'Who assigned the role' },
    ],
    defaultChannels: ['inApp', 'email'],
  },
];

async function seedTemplates(): Promise<void> {
  if (!COSMOS_ENDPOINT || !COSMOS_KEY) {
    console.error('COSMOS_ENDPOINT and COSMOS_KEY must be set');
    process.exit(1);
  }

  const client = new CosmosClient({
    endpoint: COSMOS_ENDPOINT,
    key: COSMOS_KEY,
  });

  const database = client.database(DATABASE_ID);
  const container = database.container('templates');

  console.log('Seeding system templates...');

  for (const templateData of SYSTEM_TEMPLATES) {
    try {
      // Check if template exists
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.templateId = @templateId',
          parameters: [{ name: '@templateId', value: templateData.templateId }],
        })
        .fetchAll();

      if (resources.length > 0) {
        console.log(`  Template "${templateData.templateId}" already exists, skipping`);
        continue;
      }

      // Create template
      const now = new Date().toISOString();
      const document: NotificationTemplateDocument = {
        id: uuidv4(),
        templateId: templateData.templateId,
        name: templateData.name,
        description: templateData.description,
        category: templateData.category,
        type: templateData.type,
        priority: templateData.priority,
        content: templateData.content,
        variables: templateData.variables,
        action: templateData.action,
        defaultChannels: templateData.defaultChannels,
        isActive: true,
        isSystem: true,
        createdAt: now,
        createdBy: 'system',
        updatedAt: now,
        updatedBy: 'system',
      };

      await container.items.create(document);
      console.log(`  Created template: ${templateData.templateId}`);
    } catch (error) {
      console.error(`  Error creating template "${templateData.templateId}":`, error);
    }
  }

  console.log('Seeding complete!');
}

seedTemplates().catch(console.error);

