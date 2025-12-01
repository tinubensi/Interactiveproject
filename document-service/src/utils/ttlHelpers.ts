/**
 * TTL Helper functions for calculating Time-To-Live values
 */

/**
 * Calculate TTL in seconds from an expiry date
 * TTL = (expiryDate - currentTime) in seconds
 * 
 * @param expiryDate - ISO-8601 datetime string
 * @returns TTL in seconds (positive if in future, negative if in past)
 */
export function calculateTTL(expiryDate: string): number {
  const expiry = new Date(expiryDate);
  const now = new Date();
  
  // Calculate difference in milliseconds, then convert to seconds
  const ttlMilliseconds = expiry.getTime() - now.getTime();
  const ttlSeconds = Math.floor(ttlMilliseconds / 1000);
  
  return ttlSeconds;
}

/**
 * Validate if an expiry date is in the future
 * 
 * @param expiryDate - ISO-8601 datetime string
 * @returns true if expiry date is in the future, false otherwise
 */
export function isValidExpiryDate(expiryDate: string): boolean {
  try {
    const expiry = new Date(expiryDate);
    const now = new Date();
    
    // Check if date is valid and in the future
    return !isNaN(expiry.getTime()) && expiry > now;
  } catch (error) {
    return false;
  }
}

/**
 * Validate ISO-8601 date string format
 * 
 * @param dateString - Date string to validate
 * @returns true if valid ISO-8601 format, false otherwise
 */
export function isValidISODate(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && date.toISOString() === dateString;
  } catch (error) {
    return false;
  }
}

