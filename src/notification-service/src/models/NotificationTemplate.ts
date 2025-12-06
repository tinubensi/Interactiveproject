/**
 * Notification Template Model - stored in Cosmos DB templates container
 * Partition Key: /templateId
 */

import { NotificationType, NotificationCategory, NotificationPriority } from './Notification';

/**
 * Template variable type
 */
export type VariableType = 'string' | 'number' | 'date' | 'url' | 'boolean';

/**
 * Template variable definition
 */
export interface TemplateVariable {
  name: string;
  type: VariableType;
  required: boolean;
  description: string;
  defaultValue?: string;
}

/**
 * In-app content template
 */
export interface InAppContent {
  title: string;
  message: string;
  body?: string;
}

/**
 * Email content template
 */
export interface EmailContent {
  subject: string;
  bodyHtml: string;
  bodyText: string;
}

/**
 * SMS content template
 */
export interface SmsContent {
  message: string; // Max 160 chars
}

/**
 * Push notification content template
 */
export interface PushContent {
  title: string;
  body: string;
  icon?: string;
}

/**
 * Template content for all channels
 */
export interface TemplateContent {
  inApp: InAppContent;
  email?: EmailContent;
  sms?: SmsContent;
  push?: PushContent;
}

/**
 * Template action configuration
 */
export interface TemplateAction {
  type: 'link' | 'button' | 'deeplink';
  label: string;
  urlTemplate: string;
}

/**
 * Notification channel type
 */
export type NotificationChannel = 'inApp' | 'email' | 'sms' | 'push';

/**
 * Notification Template Document
 */
export interface NotificationTemplateDocument {
  /** Document ID (UUID) */
  id: string;

  /** Template ID - Partition key */
  templateId: string;

  /** Template name */
  name: string;

  /** Description */
  description: string;

  /** Category */
  category: NotificationCategory;

  /** Default type */
  type: NotificationType;

  /** Default priority */
  priority: NotificationPriority;

  /** Content templates per channel */
  content: TemplateContent;

  /** Variable definitions */
  variables: TemplateVariable[];

  /** Optional action configuration */
  action?: TemplateAction;

  /** Default channels to use */
  defaultChannels: NotificationChannel[];

  /** Whether template is active */
  isActive: boolean;

  /** Whether template is system-defined (cannot delete) */
  isSystem: boolean;

  /** Created timestamp */
  createdAt: string;

  /** Created by user ID */
  createdBy: string;

  /** Updated timestamp */
  updatedAt: string;

  /** Updated by user ID */
  updatedBy: string;
}

/**
 * Create template request
 */
export interface CreateTemplateRequest {
  templateId: string;
  name: string;
  description: string;
  category: NotificationCategory;
  type: NotificationType;
  priority: NotificationPriority;
  content: TemplateContent;
  variables: TemplateVariable[];
  action?: TemplateAction;
  defaultChannels: NotificationChannel[];
}

/**
 * Update template request
 */
export interface UpdateTemplateRequest {
  name?: string;
  description?: string;
  category?: NotificationCategory;
  type?: NotificationType;
  priority?: NotificationPriority;
  content?: TemplateContent;
  variables?: TemplateVariable[];
  action?: TemplateAction;
  defaultChannels?: NotificationChannel[];
  isActive?: boolean;
}

/**
 * Preview template request
 */
export interface PreviewTemplateRequest {
  variables: Record<string, unknown>;
}

/**
 * Rendered content for preview
 */
export interface RenderedContent {
  inApp: {
    title: string;
    message: string;
    body?: string;
  };
  email?: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
  };
  sms?: {
    message: string;
    characterCount: number;
  };
  push?: {
    title: string;
    body: string;
  };
  action?: {
    type: string;
    label: string;
    url: string;
  };
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  missingVariables: string[];
}

/**
 * Template list response
 */
export interface TemplateListResponse {
  templates: TemplateSummary[];
  total: number;
}

/**
 * Template summary
 */
export interface TemplateSummary {
  templateId: string;
  name: string;
  category: NotificationCategory;
  type: NotificationType;
  isActive: boolean;
  isSystem: boolean;
  defaultChannels: NotificationChannel[];
}

