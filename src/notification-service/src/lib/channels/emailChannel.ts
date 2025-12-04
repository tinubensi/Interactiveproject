/**
 * Email Channel - Azure Communication Services Email
 */

import { EmailClient } from '@azure/communication-email';
import { getConfig } from '../config';
import { DeliveryStatus } from '../../models/Notification';

let emailClient: EmailClient | null = null;

/**
 * Get or create email client
 */
function getEmailClient(): EmailClient | null {
  const config = getConfig();
  
  if (!config.acs.connectionString) {
    console.warn('ACS connection string not configured - email will be logged only');
    return null;
  }

  if (emailClient) {
    return emailClient;
  }

  emailClient = new EmailClient(config.acs.connectionString);
  return emailClient;
}

/**
 * Validate email address
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Send email notification
 */
export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string,
  textBody: string
): Promise<DeliveryStatus> {
  const config = getConfig();
  const client = getEmailClient();
  const now = new Date().toISOString();

  // Validate email
  if (!validateEmail(to)) {
    return {
      sent: false,
      failed: true,
      failureReason: 'invalid_email_address',
    };
  }

  // If no client, log and return success (for dev)
  if (!client) {
    console.log(`[Email] To: ${to}, Subject: ${subject}`);
    console.log(`[Email] Body: ${textBody.substring(0, 200)}...`);
    return {
      sent: true,
      sentAt: now,
    };
  }

  try {
    const message = {
      senderAddress: config.acs.senderEmail,
      recipients: {
        to: [{ address: to }],
      },
      content: {
        subject,
        html: htmlBody,
        plainText: textBody,
      },
    };

    const poller = await client.beginSend(message);
    const response = await poller.pollUntilDone();

    if (response.status === 'Succeeded') {
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
        failureReason: response.error?.message || 'email_send_failed',
      };
    }
  } catch (error) {
    console.error('Email send error:', error);
    return {
      sent: false,
      failed: true,
      failureReason: error instanceof Error ? error.message : 'unknown_error',
    };
  }
}

/**
 * Check if email channel is available
 */
export function isEmailChannelAvailable(): boolean {
  const config = getConfig();
  return !!config.acs.connectionString;
}

/**
 * Reset email client (for testing)
 */
export function resetEmailClient(): void {
  emailClient = null;
}

