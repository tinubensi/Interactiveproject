/**
 * PII Sanitizer - Mask, partially mask, or hash sensitive data
 */

import { createHash } from 'crypto';
import { getConfig } from './config';

/**
 * PII sanitization configuration
 */
export interface PIIConfig {
  fieldsToMask: string[];
  fieldsToPartialMask: string[];
  fieldsToHash: string[];
  maskPattern: string;
}

/**
 * Get default PII config from environment
 */
export function getPIIConfig(): PIIConfig {
  const config = getConfig();
  return config.pii;
}

/**
 * Completely mask a value
 */
export function maskValue(maskPattern: string): string {
  return maskPattern;
}

/**
 * Partially mask a value (show last 4 characters)
 */
export function partialMaskValue(value: string): string {
  if (!value || value.length <= 4) {
    return '****';
  }
  return '****' + value.slice(-4);
}

/**
 * Hash a value using SHA-256
 */
export function hashValue(value: string): string {
  return createHash('sha256').update(value.toLowerCase()).digest('hex').substring(0, 16);
}

/**
 * Check if a field name matches any of the patterns
 */
export function matchesField(fieldName: string, patterns: string[]): boolean {
  const lowerField = fieldName.toLowerCase();
  return patterns.some((pattern) => lowerField.includes(pattern.toLowerCase()));
}

/**
 * Sanitize a single value based on field name
 */
export function sanitizeField(
  fieldName: string,
  value: unknown,
  config: PIIConfig
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  // Check if field should be completely masked
  if (matchesField(fieldName, config.fieldsToMask)) {
    return config.maskPattern;
  }

  // Check if field should be partially masked
  if (matchesField(fieldName, config.fieldsToPartialMask)) {
    if (typeof value === 'string') {
      return partialMaskValue(value);
    }
    return config.maskPattern;
  }

  // Check if field should be hashed
  if (matchesField(fieldName, config.fieldsToHash)) {
    if (typeof value === 'string') {
      return hashValue(value);
    }
    return value;
  }

  return value;
}

/**
 * Recursively sanitize PII from an object
 */
export function sanitizePII(
  data: unknown,
  config?: PIIConfig
): unknown {
  const piiConfig = config || getPIIConfig();

  if (data === null || data === undefined) {
    return data;
  }

  // Handle arrays
  if (Array.isArray(data)) {
    return data.map((item) => sanitizePII(item, piiConfig));
  }

  // Handle objects
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      // First check if the field itself needs sanitization
      const sanitizedValue = sanitizeField(key, value, piiConfig);
      
      // If value wasn't sanitized and is an object, recurse
      if (sanitizedValue === value && typeof value === 'object' && value !== null) {
        result[key] = sanitizePII(value, piiConfig);
      } else {
        result[key] = sanitizedValue;
      }
    }
    
    return result;
  }

  // Primitive values pass through
  return data;
}

/**
 * Sanitize changes object (before/after)
 */
export function sanitizeChanges(
  changes: {
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
    changedFields?: string[];
  } | undefined,
  config?: PIIConfig
): typeof changes {
  if (!changes) {
    return changes;
  }

  const piiConfig = config || getPIIConfig();

  return {
    before: changes.before ? sanitizePII(changes.before, piiConfig) as Record<string, unknown> : undefined,
    after: changes.after ? sanitizePII(changes.after, piiConfig) as Record<string, unknown> : undefined,
    changedFields: changes.changedFields,
  };
}

/**
 * Check if a value contains potential PII
 */
export function containsPII(data: unknown, config?: PIIConfig): boolean {
  const piiConfig = config || getPIIConfig();
  const allPIIFields = [
    ...piiConfig.fieldsToMask,
    ...piiConfig.fieldsToPartialMask,
    ...piiConfig.fieldsToHash,
  ];

  if (data === null || data === undefined) {
    return false;
  }

  if (typeof data === 'object') {
    if (Array.isArray(data)) {
      return data.some((item) => containsPII(item, piiConfig));
    }

    for (const key of Object.keys(data)) {
      if (matchesField(key, allPIIFields)) {
        return true;
      }
      if (containsPII((data as Record<string, unknown>)[key], piiConfig)) {
        return true;
      }
    }
  }

  return false;
}

