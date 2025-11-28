import { SuggestedMapping } from '../models/portalTypes';

/**
 * Calculate Levenshtein distance between two strings
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1, // deletion
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
};

/**
 * Normalize field name for comparison (lowercase, remove special chars)
 */
export const normalizeFieldName = (fieldName: string): string => {
  return fieldName
    .toLowerCase()
    .replace(/[_-]/g, '') // Remove underscores and hyphens
    .replace(/\s+/g, ''); // Remove whitespace
};

/**
 * Calculate similarity score between two field names (0-1)
 * Uses Levenshtein distance on normalized names
 */
export const calculateSimilarity = (field1: string, field2: string): number => {
  const normalized1 = normalizeFieldName(field1);
  const normalized2 = normalizeFieldName(field2);

  // Exact match after normalization
  if (normalized1 === normalized2) {
    return 1.0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLength = Math.max(normalized1.length, normalized2.length);

  if (maxLength === 0) {
    return 1.0;
  }

  // Convert distance to similarity (0-1)
  const similarity = 1 - distance / maxLength;

  // Boost similarity for common patterns
  let boost = 0;
  
  // Check if one contains the other
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    boost = 0.1;
  }

  // Check for common prefixes
  const minLength = Math.min(normalized1.length, normalized2.length);
  let commonPrefix = 0;
  for (let i = 0; i < minLength; i++) {
    if (normalized1[i] === normalized2[i]) {
      commonPrefix++;
    } else {
      break;
    }
  }
  if (commonPrefix > 3) {
    boost += 0.05;
  }

  return Math.min(1.0, similarity + boost);
};

/**
 * Field name synonyms for better matching
 */
const FIELD_SYNONYMS: Record<string, string[]> = {
  firstName: ['firstname', 'first_name', 'fname', 'givenname', 'given_name', 'first'],
  lastName: ['lastname', 'last_name', 'lname', 'surname', 'familyname', 'family_name', 'last'],
  email: ['emailaddress', 'email_address', 'e-mail', 'mail'],
  phone: ['phonenumber', 'phone_number', 'telephone', 'tel', 'mobile', 'cell'],
  address: ['streetaddress', 'street_address', 'addr', 'street'],
  city: ['cityname', 'city_name'],
  state: ['stat', 'province'],
  zip: ['zipcode', 'zip_code', 'postalcode', 'postal_code', 'postcode'],
  dateOfBirth: ['dob', 'birthdate', 'birth_date', 'dateofbirth'],
  ssn: ['socialsecuritynumber', 'social_security_number', 'ssnumber']
};

/**
 * Expand field name with synonyms for matching
 */
const expandWithSynonyms = (fieldName: string): string[] => {
  const normalized = normalizeFieldName(fieldName);
  const variants = [normalized];

  // Check if field matches any synonym key
  for (const [key, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    if (normalized === normalizeFieldName(key)) {
      variants.push(...synonyms.map(s => normalizeFieldName(s)));
      break;
    }
    // Check if field matches any synonym
    for (const synonym of synonyms) {
      if (normalized === normalizeFieldName(synonym)) {
        variants.push(normalizeFieldName(key), ...synonyms.map(s => normalizeFieldName(s)));
        break;
      }
    }
  }

  return [...new Set(variants)]; // Remove duplicates
};

/**
 * Suggest field mappings based on similarity
 */
export const suggestMappings = (
  targetField: string,
  sourceFields: string[],
  maxResults: number = 3
): SuggestedMapping[] => {
  if (sourceFields.length === 0) {
    return [];
  }

  const targetVariants = expandWithSynonyms(targetField);
  const scores: Array<{ sourceField: string; confidence: number }> = [];

  for (const sourceField of sourceFields) {
    let maxSimilarity = 0;

    // Check similarity against all target variants
    for (const targetVariant of targetVariants) {
      const similarity = calculateSimilarity(sourceField, targetVariant);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    // Also check direct similarity
    const directSimilarity = calculateSimilarity(sourceField, targetField);
    maxSimilarity = Math.max(maxSimilarity, directSimilarity);

    if (maxSimilarity > 0.3) { // Minimum threshold
      scores.push({
        sourceField,
        confidence: maxSimilarity
      });
    }
  }

  // Sort by confidence (descending) and limit results
  return scores
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults)
    .map(({ sourceField, confidence }) => ({
      sourceField,
      confidence: Math.round(confidence * 100) / 100 // Round to 2 decimal places
    }));
};

