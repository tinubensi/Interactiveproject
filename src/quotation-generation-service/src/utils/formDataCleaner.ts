/**
 * FormData Cleaner Utility
 * Removes duplicate keys with different casings from formData
 * Prevents RPA bots from receiving polluted data with firstName, firstname, Firstname, etc.
 */

export function cleanFormData(formData: any): any {
  if (!formData || typeof formData !== 'object') {
    return formData;
  }
  
  const canonicalFields = [
    'firstName', 'lastName', 'email', 'phone', 'emirate',
    'nationality', 'effectiveDate', 'visaLocation', 'occupation', 
    'homeCountry', 'dateOfBirth', 'gender', 'emiratesId',
    'monthlySalaryRange', 'salaryRange', 'visaType', 'maritalStatus',
    'passportNumber', 'visaFileNumber', 'visaExpiryDate',
    'residentialLocation', 'countryOfResidence', 'currentlyInsured',
    '_fieldLabels', '_sectionLabels', 'title', 'relation'
  ];
  
  const cleaned: any = {};
  
  // Keep canonical fields and special prefixes
  Object.keys(formData).forEach(key => {
    if (canonicalFields.includes(key) || 
        key.startsWith('lobData.') || 
        key.startsWith('section-') ||
        key.startsWith('_')) {
      cleaned[key] = formData[key];
    }
  });
  
  return cleaned;
}

/**
 * Clean formData and merge with lobData
 */
export function cleanAndMergeFormData(formData: any, lobData?: any): any {
  const cleaned = cleanFormData(formData || {});
  
  // Merge lobData fields
  if (lobData && typeof lobData === 'object') {
    Object.keys(lobData).forEach(key => {
      if (!cleaned.hasOwnProperty(key) && 
          typeof lobData[key] !== 'object' &&
          lobData[key] !== null) {
        cleaned[key] = lobData[key];
      }
    });
  }
  
  return cleaned;
}
