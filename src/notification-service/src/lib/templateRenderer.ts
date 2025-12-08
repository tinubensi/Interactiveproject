/**
 * Template Renderer - Handlebars-based template rendering
 */

import Handlebars from 'handlebars';
import {
  NotificationTemplateDocument,
  RenderedContent,
  TemplateValidationResult,
  TemplateVariable,
} from '../models/NotificationTemplate';

// Register custom helpers
let helpersRegistered = false;

/**
 * Register Handlebars helpers
 */
export function registerHelpers(): void {
  if (helpersRegistered) {
    return;
  }

  // Date formatting helper
  Handlebars.registerHelper('date', function(value: string | Date, format: string) {
    if (!value) return '';
    
    const date = typeof value === 'string' ? new Date(value) : value;
    if (isNaN(date.getTime())) return String(value);

    switch (format) {
      case 'short':
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      case 'long':
        return date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      case 'relative':
        return formatRelativeDate(date);
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
        });
      default:
        return date.toISOString().split('T')[0];
    }
  });

  // Number formatting helper
  Handlebars.registerHelper('number', function(value: number, format: string) {
    if (typeof value !== 'number') return String(value);

    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'AED',
        }).format(value);
      case 'percent':
        return `${(value * 100).toFixed(1)}%`;
      default:
        return value.toLocaleString();
    }
  });

  // Uppercase helper
  Handlebars.registerHelper('uppercase', function(value: string) {
    return typeof value === 'string' ? value.toUpperCase() : '';
  });

  // Lowercase helper
  Handlebars.registerHelper('lowercase', function(value: string) {
    return typeof value === 'string' ? value.toLowerCase() : '';
  });

  // Truncate helper
  Handlebars.registerHelper('truncate', function(value: string, length: number) {
    if (typeof value !== 'string') return '';
    if (value.length <= length) return value;
    return value.substring(0, length - 3) + '...';
  });

  helpersRegistered = true;
}

/**
 * Format relative date
 */
function formatRelativeDate(date: Date): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays === -1) return 'yesterday';
  if (diffDays > 0 && diffDays <= 7) return `in ${diffDays} days`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
  
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Render a single template string with variables
 */
export function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): string {
  registerHelpers();
  
  try {
    const compiled = Handlebars.compile(template, { noEscape: false });
    return compiled(variables);
  } catch (error) {
    console.error('Template rendering error:', error);
    return template; // Return original on error
  }
}

/**
 * Render a template string with HTML (unsafe)
 */
export function renderTemplateHtml(
  template: string,
  variables: Record<string, unknown>
): string {
  registerHelpers();
  
  try {
    const compiled = Handlebars.compile(template, { noEscape: true });
    return compiled(variables);
  } catch (error) {
    console.error('Template rendering error:', error);
    return template;
  }
}

/**
 * Render all channels for a template
 */
export function renderAllChannels(
  template: NotificationTemplateDocument,
  variables: Record<string, unknown>
): RenderedContent {
  registerHelpers();

  const result: RenderedContent = {
    inApp: {
      title: renderTemplate(template.content.inApp.title, variables),
      message: renderTemplate(template.content.inApp.message, variables),
      body: template.content.inApp.body
        ? renderTemplateHtml(template.content.inApp.body, variables)
        : undefined,
    },
  };

  // Email
  if (template.content.email) {
    result.email = {
      subject: renderTemplate(template.content.email.subject, variables),
      bodyHtml: renderTemplateHtml(template.content.email.bodyHtml, variables),
      bodyText: renderTemplate(template.content.email.bodyText, variables),
    };
  }

  // SMS
  if (template.content.sms) {
    const message = renderTemplate(template.content.sms.message, variables);
    result.sms = {
      message,
      characterCount: message.length,
    };
  }

  // Push
  if (template.content.push) {
    result.push = {
      title: renderTemplate(template.content.push.title, variables),
      body: renderTemplate(template.content.push.body, variables),
    };
  }

  // Action
  if (template.action) {
    result.action = {
      type: template.action.type,
      label: template.action.label,
      url: renderTemplate(template.action.urlTemplate, variables),
    };
  }

  return result;
}

/**
 * Validate variables against template definition
 */
export function validateVariables(
  template: NotificationTemplateDocument,
  variables: Record<string, unknown>
): TemplateValidationResult {
  const errors: string[] = [];
  const missingVariables: string[] = [];

  for (const varDef of template.variables) {
    const value = variables[varDef.name];

    // Check required
    if (varDef.required && (value === undefined || value === null || value === '')) {
      missingVariables.push(varDef.name);
      errors.push(`Missing required variable: ${varDef.name}`);
      continue;
    }

    // Skip validation if not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    const typeError = validateVariableType(varDef, value);
    if (typeError) {
      errors.push(typeError);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    missingVariables,
  };
}

/**
 * Validate variable type
 */
function validateVariableType(
  varDef: TemplateVariable,
  value: unknown
): string | null {
  switch (varDef.type) {
    case 'string':
      if (typeof value !== 'string') {
        return `Variable ${varDef.name} must be a string`;
      }
      break;
    case 'number':
      if (typeof value !== 'number') {
        return `Variable ${varDef.name} must be a number`;
      }
      break;
    case 'date':
      if (!(value instanceof Date) && typeof value !== 'string') {
        return `Variable ${varDef.name} must be a date`;
      }
      if (typeof value === 'string') {
        const date = new Date(value);
        if (isNaN(date.getTime())) {
          return `Variable ${varDef.name} is not a valid date`;
        }
      }
      break;
    case 'url':
      if (typeof value !== 'string') {
        return `Variable ${varDef.name} must be a URL string`;
      }
      // Basic URL validation
      if (!value.startsWith('/') && !value.startsWith('http')) {
        return `Variable ${varDef.name} must be a valid URL`;
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `Variable ${varDef.name} must be a boolean`;
      }
      break;
  }

  return null;
}

/**
 * Extract variable names from a template string
 */
export function extractVariableNames(template: string): string[] {
  const variablePattern = /\{\{([^}#/]+)\}\}/g;
  const variables: Set<string> = new Set();
  let match;

  while ((match = variablePattern.exec(template)) !== null) {
    // Extract the variable name (handle helpers like {{date myVar "short"}})
    const parts = match[1].trim().split(/\s+/);
    // If it's a helper, the variable is the second part
    // Otherwise it's the first part
    const varName = parts.length > 1 ? parts[1] : parts[0];
    variables.add(varName);
  }

  return Array.from(variables);
}

// Note: truncateToSmsLimit is in channels/smsChannel.ts

