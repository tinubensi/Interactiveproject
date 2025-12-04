/**
 * Template Renderer Tests
 */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  renderTemplate,
  renderTemplateHtml,
  renderAllChannels,
  validateVariables,
  extractVariableNames,
  registerHelpers,
} from '../../../lib/templateRenderer';
import { truncateToSmsLimit } from '../../../lib/channels/smsChannel';
import { NotificationTemplateDocument } from '../../../models/NotificationTemplate';

// Ensure helpers are registered
beforeEach(() => {
  registerHelpers();
});

describe('templateRenderer', () => {
  describe('renderTemplate', () => {
    it('should substitute simple variables', () => {
      const template = 'Hello, {{name}}!';
      const result = renderTemplate(template, { name: 'Ahmed' });
      assert.strictEqual(result, 'Hello, Ahmed!');
    });

    it('should handle multiple variables', () => {
      const template = '{{firstName}} {{lastName}} - {{email}}';
      const result = renderTemplate(template, {
        firstName: 'Ahmed',
        lastName: 'Mohammed',
        email: 'ahmed@example.com',
      });
      assert.strictEqual(result, 'Ahmed Mohammed - ahmed@example.com');
    });

    it('should escape HTML by default', () => {
      const template = 'Message: {{content}}';
      const result = renderTemplate(template, { content: '<script>alert("xss")</script>' });
      assert.ok(!result.includes('<script>'));
      assert.ok(result.includes('&lt;script&gt;'));
    });

    it('should handle missing variables gracefully', () => {
      const template = 'Hello, {{name}}! Your order {{orderId}} is ready.';
      const result = renderTemplate(template, { name: 'Ahmed' });
      assert.ok(result.includes('Hello, Ahmed!'));
    });

    it('should handle empty variables', () => {
      const template = 'Hello, {{name}}!';
      const result = renderTemplate(template, { name: '' });
      assert.strictEqual(result, 'Hello, !');
    });

    it('should handle numeric variables', () => {
      const template = 'Total: {{amount}} AED';
      const result = renderTemplate(template, { amount: 15000 });
      assert.strictEqual(result, 'Total: 15000 AED');
    });
  });

  describe('renderTemplateHtml', () => {
    it('should not escape HTML', () => {
      const template = '<div>{{content}}</div>';
      const result = renderTemplateHtml(template, { content: '<strong>Bold</strong>' });
      assert.ok(result.includes('<strong>Bold</strong>'));
    });
  });

  describe('date helper', () => {
    it('should format date as short', () => {
      const template = 'Date: {{date expiryDate "short"}}';
      const result = renderTemplate(template, { expiryDate: '2025-12-31' });
      assert.ok(result.includes('Dec'));
      assert.ok(result.includes('31'));
      assert.ok(result.includes('2025'));
    });

    it('should format date as long', () => {
      const template = 'Date: {{date expiryDate "long"}}';
      const result = renderTemplate(template, { expiryDate: '2025-12-31' });
      assert.ok(result.includes('December'));
    });

    it('should handle invalid date', () => {
      const template = 'Date: {{date expiryDate "short"}}';
      const result = renderTemplate(template, { expiryDate: 'invalid' });
      assert.ok(result.includes('invalid'));
    });

    it('should format date as relative', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const template = 'Due: {{date dueDate "relative"}}';
      const result = renderTemplate(template, { dueDate: tomorrow.toISOString() });
      assert.ok(result.includes('tomorrow'));
    });
  });

  describe('number helper', () => {
    it('should format as currency', () => {
      const template = 'Amount: {{number amount "currency"}}';
      const result = renderTemplate(template, { amount: 15000 });
      assert.ok(result.includes('15,000'));
      assert.ok(result.includes('AED'));
    });

    it('should format as percent', () => {
      const template = 'Rate: {{number rate "percent"}}';
      const result = renderTemplate(template, { rate: 0.15 });
      assert.strictEqual(result, 'Rate: 15.0%');
    });
  });

  describe('string helpers', () => {
    it('should convert to uppercase', () => {
      const template = '{{uppercase status}}';
      const result = renderTemplate(template, { status: 'pending' });
      assert.strictEqual(result, 'PENDING');
    });

    it('should convert to lowercase', () => {
      const template = '{{lowercase name}}';
      const result = renderTemplate(template, { name: 'AHMED' });
      assert.strictEqual(result, 'ahmed');
    });

    it('should truncate long text', () => {
      const template = '{{truncate description 20}}';
      const result = renderTemplate(template, {
        description: 'This is a very long description that should be truncated',
      });
      assert.ok(result.length <= 20);
      assert.ok(result.endsWith('...'));
    });
  });

  describe('renderAllChannels', () => {
    const mockTemplate: NotificationTemplateDocument = {
      id: 'test-id',
      templateId: 'test_template',
      name: 'Test Template',
      description: 'Test',
      category: 'approval',
      type: 'action_required',
      priority: 'high',
      content: {
        inApp: {
          title: '{{approvalType}} Approval Required',
          message: '{{requesterName}} submitted {{entityType}}',
          body: '<p>Please review the request.</p>',
        },
        email: {
          subject: 'Approval Required: {{entityType}}',
          bodyHtml: '<h1>{{approvalType}} Approval</h1><p>{{requesterName}} submitted...</p>',
          bodyText: '{{approvalType}} Approval\n\n{{requesterName}} submitted...',
        },
        sms: {
          message: 'Nectaria: {{approvalType}} approval needed from {{requesterName}}',
        },
        push: {
          title: 'Approval Required',
          body: '{{requesterName}} needs your approval',
        },
      },
      variables: [
        { name: 'approvalType', type: 'string', required: true, description: 'Type' },
        { name: 'requesterName', type: 'string', required: true, description: 'Name' },
        { name: 'entityType', type: 'string', required: true, description: 'Entity' },
        { name: 'approvalId', type: 'string', required: true, description: 'ID' },
      ],
      action: {
        type: 'link',
        label: 'Review',
        urlTemplate: '/approvals/{{approvalId}}',
      },
      defaultChannels: ['inApp', 'email'],
      isActive: true,
      isSystem: true,
      createdAt: '2025-01-01T00:00:00Z',
      createdBy: 'system',
      updatedAt: '2025-01-01T00:00:00Z',
      updatedBy: 'system',
    };

    it('should render all channels', () => {
      const variables = {
        approvalType: 'Quote',
        requesterName: 'Ahmed Mohammed',
        entityType: 'motor insurance quote',
        approvalId: 'approval-123',
      };

      const result = renderAllChannels(mockTemplate, variables);

      // In-app
      assert.strictEqual(result.inApp.title, 'Quote Approval Required');
      assert.ok(result.inApp.message.includes('Ahmed Mohammed'));

      // Email
      assert.ok(result.email);
      assert.ok(result.email.subject.includes('motor insurance quote'));

      // SMS
      assert.ok(result.sms);
      assert.ok(result.sms.message.includes('Quote'));
      assert.ok(typeof result.sms.characterCount === 'number');

      // Push
      assert.ok(result.push);
      assert.ok(result.push.body.includes('Ahmed Mohammed'));

      // Action
      assert.ok(result.action);
      assert.strictEqual(result.action.url, '/approvals/approval-123');
    });
  });

  describe('validateVariables', () => {
    const mockTemplate: NotificationTemplateDocument = {
      id: 'test-id',
      templateId: 'test_template',
      name: 'Test',
      description: 'Test',
      category: 'approval',
      type: 'info',
      priority: 'normal',
      content: {
        inApp: { title: 'Test', message: 'Test' },
      },
      variables: [
        { name: 'name', type: 'string', required: true, description: 'Name' },
        { name: 'amount', type: 'number', required: true, description: 'Amount' },
        { name: 'expiryDate', type: 'date', required: false, description: 'Date' },
        { name: 'url', type: 'url', required: false, description: 'URL' },
        { name: 'isUrgent', type: 'boolean', required: false, description: 'Urgent' },
      ],
      defaultChannels: ['inApp'],
      isActive: true,
      isSystem: false,
      createdAt: '2025-01-01T00:00:00Z',
      createdBy: 'user',
      updatedAt: '2025-01-01T00:00:00Z',
      updatedBy: 'user',
    };

    it('should validate valid variables', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        amount: 15000,
      });
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    it('should detect missing required variables', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        // amount is missing
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.missingVariables.includes('amount'));
    });

    it('should validate string type', () => {
      const result = validateVariables(mockTemplate, {
        name: 123, // Wrong type
        amount: 15000,
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('string')));
    });

    it('should validate number type', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        amount: 'not a number',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('number')));
    });

    it('should validate date type', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        amount: 15000,
        expiryDate: 'invalid-date-format',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('date')));
    });

    it('should validate url type', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        amount: 15000,
        url: 'not-a-url',
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('URL')));
    });

    it('should accept valid relative URLs', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        amount: 15000,
        url: '/approvals/123',
      });
      assert.strictEqual(result.valid, true);
    });

    it('should validate boolean type', () => {
      const result = validateVariables(mockTemplate, {
        name: 'Ahmed',
        amount: 15000,
        isUrgent: 'yes', // Wrong type
      });
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some((e) => e.includes('boolean')));
    });
  });

  describe('extractVariableNames', () => {
    it('should extract simple variables', () => {
      const template = 'Hello {{name}}, your order {{orderId}} is ready.';
      const result = extractVariableNames(template);
      assert.ok(result.includes('name'));
      assert.ok(result.includes('orderId'));
    });

    it('should extract variables from helpers', () => {
      const template = 'Due: {{date expiryDate "short"}}';
      const result = extractVariableNames(template);
      assert.ok(result.includes('expiryDate'));
    });

    it('should return unique variables', () => {
      const template = '{{name}} - {{name}} - {{name}}';
      const result = extractVariableNames(template);
      assert.strictEqual(result.length, 1);
    });
  });

  describe('truncateToSmsLimit', () => {
    it('should not truncate short messages', () => {
      const message = 'Short message';
      const result = truncateToSmsLimit(message);
      assert.strictEqual(result.text, message);
      assert.strictEqual(result.truncated, false);
    });

    it('should truncate long messages to 160 chars', () => {
      const message = 'A'.repeat(200);
      const result = truncateToSmsLimit(message);
      assert.strictEqual(result.text.length, 160);
      assert.strictEqual(result.truncated, true);
      assert.ok(result.text.endsWith('...'));
    });

    it('should handle exactly 160 characters', () => {
      const message = 'A'.repeat(160);
      const result = truncateToSmsLimit(message);
      assert.strictEqual(result.text, message);
      assert.strictEqual(result.truncated, false);
    });
  });
});

