/**
 * SMS Channel - Azure Communication Services SMS
 */

import { SmsClient } from '@azure/communication-sms';
import { getConfig } from '../config';
import { DeliveryStatus } from '../../models/Notification';

let smsClient: SmsClient | null = null;

const SMS_MAX_LENGTH = 160;

/**
 * Get or create SMS client
 */
function getSmsClient(): SmsClient | null {
  const config = getConfig();
  
  if (!config.acs.connectionString) {
    console.warn('ACS connection string not configured - SMS will be logged only');
    return null;
  }

  if (smsClient) {
    return smsClient;
  }

  smsClient = new SmsClient(config.acs.connectionString);
  return smsClient;
}

/**
 * Validate phone number (basic validation)
 */
export function validatePhoneNumber(phone: string): boolean {
  // Basic validation - should start with + and have at least 10 digits
  const phoneRegex = /^\+[\d]{10,15}$/;
  return phoneRegex.test(phone.replace(/[\s-]/g, ''));
}

/**
 * Truncate message to SMS limit
 */
export function truncateToSmsLimit(message: string): { text: string; truncated: boolean } {
  if (message.length <= SMS_MAX_LENGTH) {
    return { text: message, truncated: false };
  }

  return {
    text: message.substring(0, SMS_MAX_LENGTH - 3) + '...',
    truncated: true,
  };
}

/**
 * Send SMS notification
 */
export async function sendSms(
  to: string,
  message: string
): Promise<DeliveryStatus> {
  const config = getConfig();
  const client = getSmsClient();
  const now = new Date().toISOString();

  // Validate phone number
  if (!validatePhoneNumber(to)) {
    return {
      sent: false,
      failed: true,
      failureReason: 'invalid_phone_number',
    };
  }

  // Truncate message
  const { text, truncated } = truncateToSmsLimit(message);
  if (truncated) {
    console.warn(`SMS message truncated from ${message.length} to ${SMS_MAX_LENGTH} characters`);
  }

  // If no client, log and return success (for dev)
  if (!client) {
    console.log(`[SMS] To: ${to}, Message: ${text}`);
    return {
      sent: true,
      sentAt: now,
    };
  }

  // Check if sender phone is configured
  if (!config.acs.senderPhone) {
    return {
      sent: false,
      failed: true,
      failureReason: 'sms_sender_not_configured',
    };
  }

  try {
    const sendResults = await client.send({
      from: config.acs.senderPhone,
      to: [to],
      message: text,
    });

    const result = sendResults[0];

    if (result.successful) {
      return {
        sent: true,
        sentAt: now,
        delivered: true,
        deliveredAt: now,
      };
    } else {
      return {
        sent: false,
        failed: true,
        failureReason: result.errorMessage || 'sms_send_failed',
      };
    }
  } catch (error) {
    console.error('SMS send error:', error);
    return {
      sent: false,
      failed: true,
      failureReason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

/**
 * Check if SMS channel is available
 */
export function isSmsChannelAvailable(): boolean {
  const config = getConfig();
  return !!config.acs.connectionString && !!config.acs.senderPhone;
}

/**
 * Reset SMS client (for testing)
 */
export function resetSmsClient(): void {
  smsClient = null;
}

