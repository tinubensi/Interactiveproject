/**
 * Data Pre-fill Service
 * Maps lead data and existing EMAF submissions to EMAF form structure
 * Supports both Sukoon and Al Sagr vendors
 * Uses canonical model with vendor adapters for unified data structure
 */

import { UnifiedEmafData } from '../models/canonicalEmafTypes';
import { adapterRegistry } from '../adapters/AdapterRegistry';

interface LeadData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: {
    number?: string;
    countryCode?: string;
  };
  emirate?: string;
  customerId?: string;
  lobData?: {
    dateOfBirth?: string;
    gender?: string;
    height?: string | number;
    weight?: string | number;
    nationality?: string;
    emiratesId?: string;
    passportNumber?: string;
    maritalStatus?: string;
    occupation?: string;
    address?: string;
    poBox?: string;
    sponsorName?: string;
    salary?: string;
    currentlyInsured?: boolean;
    currentInsurer?: string;
    currentPolicyExpiryDate?: string;
    dependents?: Array<{
      name: string;
      relationship: 'Spouse' | 'Child' | 'Parent';
      dateOfBirth: string;
      gender: 'Male' | 'Female';
    }>;
  };
}

interface CustomerData {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  name?: string;
  dateOfBirth?: string;
  email?: string;
  email2?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  emiratesId?: string;
  nationality?: string;
  gender?: string;
  address?: string;
  emirate?: string;
  occupation?: string;
  maritalStatus?: string;
  passportNumber?: string;
  visaType?: string;
  visaFileNumber?: string;
  visaExpiryDate?: string;
  monthlySalaryRange?: string;
  [key: string]: unknown;
}

interface ExistingEmafData {
  formData?: Record<string, any>;
}

interface PrefilledFormData {
  memberDetails: {
    applicantName?: string;
    relationship?: string;
    address?: string;
    poBox?: string;
    email?: string;
    contactNumber?: string;
    emiratesId?: string;
    occupation?: string;
    sponsorName?: string;
    salary?: 'up_to_4000' | 'above_4000';
  };
  previousInsurance?: {
    hasInsurance?: boolean;
    policyNumber?: string;
    expiryDate?: string;
  };
  members?: Array<{
    name?: string;
    nationality?: string;
    passportOrEmiratesId?: string;
    relationship?: string;
    maritalStatus?: string;
    dateOfBirth?: string;
    gender?: string;
    height?: string;
    weight?: string;
    visaEmirate?: string;
  }>;
  medicalHistory?: Record<string, any>;
  specificMedicalHistory?: Record<string, boolean>;
  yesAnswerDetails?: Array<any>;
  signature?: {
    applicantName?: string;
    date?: string;
    emiratesId?: string;
  };
}

class DataPrefillService {
  /**
   * Check if vendor is Al Sagr (handles various formats: alsagr, al-sagr, vendor-alsagr)
   */
  private isAlSagrVendor(vendorId?: string): boolean {
    if (!vendorId) return false;
    const normalized = vendorId.toLowerCase().trim();
    return normalized.includes('alsagr') || normalized.includes('al-sagr');
  }

  /**
   * Normalize gender value for form
   */
  private normalizeGender(gender?: string, vendorId?: string): string | undefined {
    if (!gender) return undefined;
    const normalized = gender.trim();
    if (this.isAlSagrVendor(vendorId)) {
      return normalized.toLowerCase();
    }
    // Sukoon uses capitalized format
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }

  /**
   * Normalize marital status value for form
   */
  private normalizeMaritalStatus(status?: string, vendorId?: string): string | undefined {
    if (!status) return undefined;
    const normalized = status.trim();
    if (this.isAlSagrVendor(vendorId)) {
      return normalized.toLowerCase();
    }
    // Sukoon uses capitalized format
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }

  /**
   * Normalize relationship value for form
   */
  private normalizeRelationship(relationship?: string, vendorId?: string): string | undefined {
    if (!relationship) return undefined;
    const normalized = relationship.trim();
    if (this.isAlSagrVendor(vendorId)) {
      return normalized.toLowerCase();
    }
    // Sukoon uses capitalized format
    return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
  }

  /**
   * Normalize emirate value to dropdown option
   */
  private normalizeEmirate(emirate?: string): string | undefined {
    if (!emirate) return undefined;
    const emirateMap: Record<string, string> = {
      'dubai': 'dubai',
      'abu dhabi': 'abu_dhabi',
      'abudhabi': 'abu_dhabi',
      'sharjah': 'sharjah',
      'ajman': 'ajman',
      'umm al quwain': 'uaq',
      'uaq': 'uaq',
      'ras al khaimah': 'rak',
      'rak': 'rak',
      'fujairah': 'fujairah',
    };
    const normalized = emirate.toLowerCase().trim();
    return emirateMap[normalized] || normalized;
  }

  /**
   * Convert salary to form format
   */
  private convertSalary(salary?: string): 'up_to_4000' | 'above_4000' | undefined {
    if (!salary) return undefined;
    const salaryStr = String(salary).toLowerCase();
    if (salaryStr.includes('4000') || 
        salaryStr.includes('up to') ||
        (parseInt(salaryStr) <= 4000 && !isNaN(parseInt(salaryStr)))) {
      return 'up_to_4000';
    }
    return 'above_4000';
  }

  /**
   * Pre-fill form data from lead and existing EMAF data
   * NEW: Uses canonical model with vendor adapters
   * @param leadData - Lead data from lead service
   * @param existingEmafData - Existing EMAF submission data (if any)
   * @param vendorId - Vendor ID (e.g., 'sukoon', 'alsagr')
   * @param customerData - Optional customer data for enhanced prefill
   * @returns Object with both canonical and vendor-specific formats
   */
  prefillFromLeadAndEmaf(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData,
    vendorId?: string,
    customerData?: CustomerData
  ): { canonical: UnifiedEmafData; vendorFormat: Record<string, any> } {
    // Build canonical structure from sources
    const canonical = this.buildCanonicalFromSources(leadData, customerData, existingEmafData);
    
    // Convert to vendor format using adapter
    const normalizedVendorId = vendorId || 'sukoon';
    const adapter = adapterRegistry.getAdapter(normalizedVendorId);
    const vendorFormat = adapter.fromCanonical(canonical);
    
    return { canonical, vendorFormat };
  }

  /**
   * Legacy method signature for backward compatibility
   * @deprecated Use prefillFromLeadAndEmaf which returns both formats
   */
  prefillFromLeadAndEmafLegacy(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData,
    vendorId?: string,
    customerData?: CustomerData
  ): PrefilledFormData | Record<string, any> {
    // If existing EMAF data exists and we're not prefilling, use it as base
    if (existingEmafData?.formData && !leadData) {
      return existingEmafData.formData;
    }

    // Use new method and return vendor format
    const { vendorFormat } = this.prefillFromLeadAndEmaf(leadData, existingEmafData, vendorId, customerData);
    return vendorFormat;
  }

  /**
   * Build canonical model from lead and customer data
   */
  private buildCanonicalFromSources(
    leadData?: LeadData,
    customerData?: CustomerData,
    existingEmafData?: ExistingEmafData
  ): UnifiedEmafData {
    // If we have existing canonical data, use it as base
    if (existingEmafData && (existingEmafData as any).canonicalData) {
      return (existingEmafData as any).canonicalData;
    }

    // Build from lead/customer data
    const canonical: UnifiedEmafData = {
      policyHolder: {
        fullName: customerData?.name || 
          `${leadData?.firstName || ''} ${leadData?.lastName || ''}`.trim() || '',
        email: customerData?.email || leadData?.email || '',
        phone: this.formatPhone(leadData?.phone || (customerData?.mobileNumber ? { number: customerData.mobileNumber } : undefined) || (customerData?.phoneNumber ? { number: customerData.phoneNumber } : undefined)),
        emiratesId: this.validateEmiratesId(customerData?.emiratesId || leadData?.lobData?.emiratesId),
        nationality: customerData?.nationality || leadData?.lobData?.nationality,
        dateOfBirth: customerData?.dateOfBirth || leadData?.lobData?.dateOfBirth,
        gender: this.normalizeGenderToCanonical(customerData?.gender || leadData?.lobData?.gender),
        maritalStatus: this.normalizeMaritalStatusToCanonical(customerData?.maritalStatus || leadData?.lobData?.maritalStatus),
        height: this.parseNumber(leadData?.lobData?.height),
        weight: this.parseNumber(leadData?.lobData?.weight),
        emirate: this.normalizeEmirate(leadData?.emirate || customerData?.emirate),
        address: leadData?.lobData?.address || customerData?.address,
        poBox: leadData?.lobData?.poBox,
        occupation: customerData?.occupation || leadData?.lobData?.occupation,
        sponsorName: leadData?.lobData?.sponsorName,
        salary: this.convertSalary(customerData?.monthlySalaryRange || leadData?.lobData?.salary),
      },
      insuredMembers: this.buildInsuredMembers(leadData, customerData),
      previousInsurance: this.buildPreviousInsurance(leadData),
    };

    // Merge with existing formData if available (convert to canonical first)
    if (existingEmafData?.formData) {
      const vendorId = this.detectVendorFromFormData(existingEmafData.formData);
      if (vendorId) {
        try {
          const adapter = adapterRegistry.getAdapter(vendorId);
          const existingCanonical = adapter.toCanonical(existingEmafData.formData);
          // Merge: prefer existing canonical data, fill gaps from new canonical
          return this.mergeCanonicalData(existingCanonical, canonical);
        } catch (error) {
          // If conversion fails, just use new canonical
          console.warn('Failed to convert existing formData to canonical, using new data:', error);
        }
      }
    }

    return canonical;
  }

  /**
   * Build insured members array from lead data
   */
  private buildInsuredMembers(leadData?: LeadData, customerData?: CustomerData): UnifiedEmafData['insuredMembers'] {
    const members: UnifiedEmafData['insuredMembers'] = [];

    // Add principal (self)
    if (leadData) {
      const principalName = customerData?.name || 
        `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim();
      
      if (principalName) {
        members.push({
          id: 'principal',
          type: 'principal',
          name: principalName,
          relationship: 'self',
          dateOfBirth: customerData?.dateOfBirth || leadData.lobData?.dateOfBirth,
          gender: this.normalizeGenderToCanonical(customerData?.gender || leadData.lobData?.gender),
          maritalStatus: this.normalizeMaritalStatusToCanonical(customerData?.maritalStatus || leadData.lobData?.maritalStatus),
          nationality: customerData?.nationality || leadData.lobData?.nationality,
          emiratesId: this.validateEmiratesId(customerData?.emiratesId || leadData.lobData?.emiratesId),
          passportNumber: customerData?.passportNumber || leadData.lobData?.passportNumber,
          height: this.parseNumber(leadData.lobData?.height),
          weight: this.parseNumber(leadData.lobData?.weight),
          visaEmirate: leadData.emirate || customerData?.emirate,
        });
      }
    }

    // Add dependents
    if (leadData?.lobData?.dependents) {
      leadData.lobData.dependents.forEach((dep, idx) => {
        const type = dep.relationship === 'Spouse' ? 'spouse' : 'dependent';
        members.push({
          id: type === 'spouse' ? 'spouse' : `dependent-${idx}`,
          type,
          name: dep.name,
          relationship: dep.relationship.toLowerCase() as 'self' | 'spouse' | 'child' | 'parent',
          dateOfBirth: dep.dateOfBirth,
          gender: this.normalizeGenderToCanonical(dep.gender),
        });
      });
    }

    return members;
  }

  /**
   * Build previous insurance data from lead
   */
  private buildPreviousInsurance(leadData?: LeadData): UnifiedEmafData['previousInsurance'] {
    return {
      hasInsurance: leadData?.lobData?.currentlyInsured || false,
      members: leadData?.lobData?.currentlyInsured ? [{
        memberId: 'principal',
        insuranceCompany: leadData.lobData.currentInsurer,
        policyNumber: leadData.lobData.currentInsurer,
        expiryDate: leadData.lobData.currentPolicyExpiryDate,
      }] : [],
    };
  }

  /**
   * Merge two canonical data objects (existing takes precedence)
   */
  private mergeCanonicalData(
    existing: UnifiedEmafData,
    newData: UnifiedEmafData
  ): UnifiedEmafData {
    return {
      policyHolder: {
        ...newData.policyHolder,
        ...existing.policyHolder,
        // Only override if existing has value
        fullName: existing.policyHolder.fullName || newData.policyHolder.fullName,
        email: existing.policyHolder.email || newData.policyHolder.email,
        phone: existing.policyHolder.phone || newData.policyHolder.phone,
      },
      insuredMembers: existing.insuredMembers.length > 0 ? existing.insuredMembers : newData.insuredMembers,
      previousInsurance: {
        hasInsurance: existing.previousInsurance.hasInsurance || newData.previousInsurance.hasInsurance,
        members: existing.previousInsurance.members.length > 0 
          ? existing.previousInsurance.members 
          : newData.previousInsurance.members,
      },
      medicalHistory: existing.medicalHistory || newData.medicalHistory,
      signature: existing.signature || newData.signature,
    };
  }

  /**
   * Detect vendor from form data structure
   */
  private detectVendorFromFormData(formData: Record<string, any>): string | null {
    if (formData.policyHolder_fullName) {
      return 'alsagr';
    }
    if (formData.memberDetails) {
      return 'sukoon';
    }
    return null;
  }

  /**
   * Normalize gender to canonical format
   */
  private normalizeGenderToCanonical(gender?: string): 'male' | 'female' | undefined {
    if (!gender) return undefined;
    const normalized = gender.toLowerCase().trim();
    return normalized === 'male' || normalized === 'm' ? 'male' : 'female';
  }

  /**
   * Normalize marital status to canonical format
   */
  private normalizeMaritalStatusToCanonical(status?: string): 'single' | 'married' | 'divorced' | 'widowed' | undefined {
    if (!status) return undefined;
    return status.toLowerCase().trim() as 'single' | 'married' | 'divorced' | 'widowed';
  }

  /**
   * Validate Emirates ID (ensure it's not an emirate name)
   */
  private validateEmiratesId(id?: string): string | undefined {
    if (!id) return undefined;
    const trimmedId = String(id).trim();
    if (trimmedId && trimmedId.length > 0 && trimmedId !== 'null' && trimmedId !== 'undefined') {
      // Check if it's NOT just text (emirate name)
      const isLikelyEmirateName = /^[A-Za-z\s]+$/.test(trimmedId) && !/[\d-]/.test(trimmedId);
      if (!isLikelyEmirateName) {
        return trimmedId;
      }
    }
    return undefined;
  }

  /**
   * Parse number from string or number
   */
  private parseNumber(value?: string | number): number | undefined {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed;
    }
    return undefined;
  }

  /**
   * Format phone number with country code
   */
  private formatPhone(phone?: { number?: string; countryCode?: string }): string {
    if (!phone?.number) return '';
    
    const number = phone.number;
    if (number.startsWith('+')) return number;
    if (number.startsWith('971')) return `+${number}`;
    
    const countryCode = phone.countryCode || '971';
    const formattedCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
    return `${formattedCode}${number}`;
  }

  /**
   * Pre-fill Sukoon EMAF form from lead data
   * @deprecated Use prefillFromLeadAndEmaf with canonical model instead
   */
  private prefillSukoonFromLead(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData,
    customerData?: CustomerData
  ): PrefilledFormData {
    const prefilled: PrefilledFormData = {
      memberDetails: {},
      members: []
    };

    // Pre-fill from lead data
    if (leadData) {
      // Section 1: Member Details
      const applicantName = customerData?.name || 
        (leadData.firstName || leadData.lastName 
          ? `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim()
          : undefined);
      
      if (applicantName) {
        prefilled.memberDetails.applicantName = applicantName;
      }

      prefilled.memberDetails.email = customerData?.email || leadData.email;
      prefilled.memberDetails.relationship = 'Self';

      if (leadData.phone?.number) {
        let phoneNumber = leadData.phone.number;
        // Check if number already includes country code
        if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('971')) {
          const countryCode = leadData.phone.countryCode || '971';
          // Add + if countryCode doesn't have it
          const formattedCountryCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
          prefilled.memberDetails.contactNumber = `${formattedCountryCode}${phoneNumber}`;
        } else {
          // Number already has country code, use as is
          prefilled.memberDetails.contactNumber = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
        }
      } else if (customerData?.mobileNumber || customerData?.phoneNumber) {
        prefilled.memberDetails.contactNumber = customerData.mobileNumber || customerData.phoneNumber;
      }

      prefilled.memberDetails.address = leadData.emirate || customerData?.emirate || customerData?.address || leadData.lobData?.address;

      if (leadData.lobData) {
        const lob = leadData.lobData;

        // Only set emiratesId if it's actually an Emirates ID (not an emirate name)
        const emiratesId = customerData?.emiratesId || lob.emiratesId;
        // Validate that it looks like an Emirates ID (contains numbers and dashes, not just text)
        if (emiratesId && /[\d-]/.test(emiratesId) && !/^[A-Za-z\s]+$/.test(emiratesId)) {
          prefilled.memberDetails.emiratesId = emiratesId;
        }
        prefilled.memberDetails.occupation = customerData?.occupation || lob.occupation;
        prefilled.memberDetails.address = lob.address || prefilled.memberDetails.address;
        prefilled.memberDetails.poBox = lob.poBox;
        prefilled.memberDetails.sponsorName = lob.sponsorName;
        prefilled.memberDetails.salary = this.convertSalary(customerData?.monthlySalaryRange || lob.salary);

        // Section 2: Previous Insurance
        if (lob.currentlyInsured !== undefined) {
          prefilled.previousInsurance = {
            hasInsurance: lob.currentlyInsured,
            policyNumber: lob.currentInsurer,
            expiryDate: lob.currentPolicyExpiryDate
          };
        }

        // Section 3: Members array (self + dependents)
        const members: Array<{
          name?: string;
          nationality?: string;
          passportOrEmiratesId?: string;
          relationship?: string;
          maritalStatus?: string;
          dateOfBirth?: string;
          gender?: string;
          height?: string;
          weight?: string;
          visaEmirate?: string;
        }> = [];

        // Add self as first member
        if (lob.dateOfBirth || lob.gender || lob.nationality) {
          members.push({
            name: prefilled.memberDetails.applicantName,
            nationality: lob.nationality || customerData?.nationality,
            passportOrEmiratesId: lob.emiratesId || lob.passportNumber || customerData?.emiratesId || customerData?.passportNumber,
            relationship: 'Self',
            maritalStatus: this.normalizeMaritalStatus(lob.maritalStatus || customerData?.maritalStatus),
            dateOfBirth: lob.dateOfBirth || customerData?.dateOfBirth,
            gender: this.normalizeGender(lob.gender || customerData?.gender),
            height: lob.height ? String(lob.height) : undefined,
            weight: lob.weight ? String(lob.weight) : undefined,
            visaEmirate: leadData.emirate || customerData?.emirate
          });
        }

        // Add dependents
        if (lob.dependents && Array.isArray(lob.dependents)) {
          for (const dependent of lob.dependents) {
            members.push({
              name: dependent.name,
              relationship: this.normalizeRelationship(dependent.relationship),
              dateOfBirth: dependent.dateOfBirth,
              gender: this.normalizeGender(dependent.gender),
              // Other fields left empty as not available in dependents data
            });
          }
        }

        if (members.length > 0) {
          prefilled.members = members;
        }
      }

      // Section 8: Signature
      if (prefilled.memberDetails.applicantName || prefilled.memberDetails.emiratesId) {
        prefilled.signature = {
          applicantName: prefilled.memberDetails.applicantName,
          emiratesId: prefilled.memberDetails.emiratesId,
          // date: Leave empty - user should fill current date
        };
      }
    }

    // Merge with existing data if provided
    if (existingEmafData?.formData) {
      return this.mergeFormData(existingEmafData.formData, prefilled) as PrefilledFormData;
    }

    return prefilled;
  }

  /**
   * Pre-fill Al Sagr EMAF form from lead data
   * @deprecated Use prefillFromLeadAndEmaf with canonical model instead
   */
  private prefillAlSagrFromLead(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData,
    customerData?: CustomerData
  ): Record<string, any> {
    const prefilled: Record<string, any> = {};

    if (!leadData) {
      return existingEmafData?.formData || prefilled;
    }

    const applicantName = customerData?.name || 
      (leadData.firstName || leadData.lastName 
        ? `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim()
        : undefined);

    // Section 1: Policy Holder Information
    if (applicantName) {
      prefilled.policyHolder_fullName = applicantName;
    }
    // Set nationality from lead or customer data (prioritize customer data)
    // Check multiple possible sources
    const nationality = customerData?.nationality || 
                       leadData.lobData?.nationality ||
                       (customerData as any)?.nationalityCode ||
                       (leadData.lobData as any)?.nationalityCode;
    if (nationality) {
      const nationalityStr = String(nationality).trim();
      if (nationalityStr.length > 0 && nationalityStr !== 'null' && nationalityStr !== 'undefined') {
        prefilled.policyHolder_nationality = nationalityStr;
      }
    }
    
    // Set Emirates ID - validate that it's actually an Emirates ID (not an emirate name)
    // Prioritize customer data over lead data, check multiple possible field names
    const emiratesId = customerData?.emiratesId || 
                      leadData.lobData?.emiratesId ||
                      (customerData as any)?.emiratesID ||
                      (leadData.lobData as any)?.emiratesID ||
                      (customerData as any)?.emirateId ||
                      (leadData.lobData as any)?.emirateId;
    if (emiratesId) {
      const trimmedId = String(emiratesId).trim();
      if (trimmedId && trimmedId.length > 0 && trimmedId !== 'null' && trimmedId !== 'undefined') {
        // Check if it's NOT just text (emirate name like "Sharjah", "Dubai", etc.)
        // Valid Emirates IDs contain numbers and/or dashes
        const isLikelyEmirateName = /^[A-Za-z\s]+$/.test(trimmedId) && !/[\d-]/.test(trimmedId);
        if (!isLikelyEmirateName) {
          // If it has numbers or dashes, it's likely a valid Emirates ID
          prefilled.policyHolder_emiratesId = trimmedId;
        }
        // If it's just text without numbers, skip it (it's likely an emirate name)
      }
    }
    
    // Debug: Log what we found
    if (!prefilled.policyHolder_nationality) {
      console.log(`⚠ Nationality not found - customerData.nationality: ${customerData?.nationality}, lobData.nationality: ${leadData.lobData?.nationality}`);
    }
    if (!prefilled.policyHolder_emiratesId) {
      console.log(`⚠ Emirates ID not found - customerData.emiratesId: ${customerData?.emiratesId}, lobData.emiratesId: ${leadData.lobData?.emiratesId}`);
    }
    prefilled.policyHolder_emirate = this.normalizeEmirate(leadData.emirate || customerData?.emirate);
    prefilled.policyHolder_maritalStatus = this.normalizeMaritalStatus(
      leadData.lobData?.maritalStatus || customerData?.maritalStatus,
      'alsagr'
    );
    prefilled.policyHolder_dob = leadData.lobData?.dateOfBirth || customerData?.dateOfBirth;
    prefilled.policyHolder_gender = this.normalizeGender(
      leadData.lobData?.gender || customerData?.gender,
      'alsagr'
    );
    prefilled.policyHolder_height = leadData.lobData?.height ? String(leadData.lobData.height) : undefined;
    prefilled.policyHolder_weight = leadData.lobData?.weight ? String(leadData.lobData.weight) : undefined;
    
    if (leadData.phone?.number) {
      let phoneNumber = leadData.phone.number;
      // Check if number already includes country code
      if (!phoneNumber.startsWith('+') && !phoneNumber.startsWith('971')) {
        const countryCode = leadData.phone.countryCode || '971';
        // Add + if countryCode doesn't have it
        const formattedCountryCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
        prefilled.policyHolder_mobile = `${formattedCountryCode}${phoneNumber}`;
      } else {
        // Number already has country code, use as is
        prefilled.policyHolder_mobile = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
      }
      prefilled.policyHolder_contactNumber = prefilled.policyHolder_mobile;
    } else if (customerData?.mobileNumber || customerData?.phoneNumber) {
      prefilled.policyHolder_mobile = customerData.mobileNumber || customerData.phoneNumber;
      prefilled.policyHolder_contactNumber = prefilled.policyHolder_mobile;
    }
    
    prefilled.policyHolder_email = customerData?.email || leadData.email;
    prefilled.policyHolder_occupation = customerData?.occupation || leadData.lobData?.occupation;
    prefilled.policyHolder_location = leadData.emirate || customerData?.emirate || leadData.lobData?.address || customerData?.address;
    prefilled.policyHolder_salary = customerData?.monthlySalaryRange || leadData.lobData?.salary;

    // Section 2: Insured Members - Principal (same as policy holder)
    prefilled.principal_name = prefilled.policyHolder_fullName;
    prefilled.principal_relation = 'self';
    prefilled.principal_gender = prefilled.policyHolder_gender;
    prefilled.principal_maritalStatus = prefilled.policyHolder_maritalStatus;
    prefilled.principal_dob = prefilled.policyHolder_dob;
    prefilled.principal_height = prefilled.policyHolder_height;
    prefilled.principal_weight = prefilled.policyHolder_weight;

    // Section 2: Insured Members - Spouse
    const spouse = leadData.lobData?.dependents?.find(d => d.relationship === 'Spouse');
    if (spouse) {
      prefilled.spouse_name = spouse.name;
      prefilled.spouse_relation = 'spouse';
      prefilled.spouse_gender = this.normalizeGender(spouse.gender, 'alsagr');
      prefilled.spouse_maritalStatus = 'married';
      prefilled.spouse_dob = spouse.dateOfBirth;
    }

    // Section 2: Insured Members - Dependents 1-5
    const otherDependents = leadData.lobData?.dependents?.filter(d => d.relationship !== 'Spouse') || [];
    for (let i = 0; i < Math.min(5, otherDependents.length); i++) {
      const dependent = otherDependents[i];
      const index = i + 1;
      prefilled[`dependent${index}_name`] = dependent.name;
      prefilled[`dependent${index}_relation`] = this.normalizeRelationship(dependent.relationship, 'alsagr');
      prefilled[`dependent${index}_gender`] = this.normalizeGender(dependent.gender, 'alsagr');
      // Determine marital status based on relationship and age
      if (dependent.relationship === 'Child') {
        prefilled[`dependent${index}_maritalStatus`] = 'single';
      } else if (dependent.relationship === 'Parent') {
        prefilled[`dependent${index}_maritalStatus`] = prefilled.policyHolder_maritalStatus || 'married';
      } else {
        prefilled[`dependent${index}_maritalStatus`] = 'single';
      }
      prefilled[`dependent${index}_dob`] = dependent.dateOfBirth;
    }

    // Section 3: Previous Insurance
    if (leadData.lobData?.currentlyInsured) {
      prefilled.principal_prevInsuranceCompany = leadData.lobData.currentInsurer;
      prefilled.principal_prevPolicyExpiry = leadData.lobData.currentPolicyExpiryDate;
      // If spouse exists, assume same insurance (can be enhanced later)
      if (spouse) {
        prefilled.spouse_prevInsuranceCompany = leadData.lobData.currentInsurer;
        prefilled.spouse_prevPolicyExpiry = leadData.lobData.currentPolicyExpiryDate;
      }
    }

    // Merge with existing data if provided
    if (existingEmafData?.formData) {
      return { ...prefilled, ...existingEmafData.formData };
    }

    return prefilled;
  }

  /**
   * Merge existing form data with new pre-filled data
   * Smart merge: Only fills empty/undefined/null fields from prefilled data
   * Existing data takes precedence for non-empty values
   */
  private mergeFormData(
    existing: Record<string, any>,
    prefilled: PrefilledFormData | Record<string, any>
  ): PrefilledFormData | Record<string, any> {
    // Check if this is Al Sagr (flat structure) or Sukoon (nested structure)
    if (prefilled && 'policyHolder_fullName' in prefilled) {
      // Al Sagr flat structure
      const merged: Record<string, any> = { ...existing };
      for (const key in prefilled) {
        if (prefilled.hasOwnProperty(key)) {
          const existingValue = existing[key];
          const prefilledValue = prefilled[key];
          // Only fill if existing value is empty
          if (
            existingValue === undefined ||
            existingValue === null ||
            existingValue === '' ||
            (typeof existingValue === 'string' && existingValue.trim() === '')
          ) {
            merged[key] = prefilledValue;
          }
        }
      }
      return merged;
    } else {
      // Sukoon nested structure
      const sukoonPrefilled = prefilled as PrefilledFormData;
      return {
        memberDetails: {
          ...sukoonPrefilled.memberDetails,
          ...existing.memberDetails
        },
        previousInsurance: {
          ...sukoonPrefilled.previousInsurance,
          ...existing.previousInsurance
        },
        members: existing.members || sukoonPrefilled.members || [],
        medicalHistory: existing.medicalHistory || sukoonPrefilled.medicalHistory,
        specificMedicalHistory: existing.specificMedicalHistory || sukoonPrefilled.specificMedicalHistory,
        yesAnswerDetails: existing.yesAnswerDetails || sukoonPrefilled.yesAnswerDetails || [],
        signature: {
          ...sukoonPrefilled.signature,
          ...existing.signature
        }
      };
    }
  }

  /**
   * Pre-fill from multiple sources (lead, existing EMAF, customer profile)
   * @deprecated Use prefillFromLeadAndEmaf instead
   */
  prefillFromMultipleSources(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData,
    vendorId?: string,
    customerData?: CustomerData
  ): PrefilledFormData | Record<string, any> {
    // Use legacy method for backward compatibility
    return this.prefillFromLeadAndEmafLegacy(leadData, existingEmafData, vendorId, customerData);
  }
}

export const dataPrefillService = new DataPrefillService();
