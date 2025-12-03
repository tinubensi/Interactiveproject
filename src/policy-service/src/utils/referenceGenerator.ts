/**
 * Reference ID Generator for Policy Requests
 * Format: POL-REQ-2024-001, POL-2024-001, etc.
 */

export function generatePolicyRequestReferenceId(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-6);
  return `POL-REQ-${year}-${timestamp}`;
}

export function generatePolicyNumber(): string {
  const year = new Date().getFullYear();
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `POL-${year}-${timestamp}-${random}`;
}


