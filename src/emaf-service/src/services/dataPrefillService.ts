/**
 * Data Pre-fill Service
 * Maps lead data and existing EMAF submissions to Sukoon EMAF form structure
 */

interface LeadData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: {
    number?: string;
    countryCode?: string;
  };
  emirate?: string;
  lobData?: {
    dateOfBirth?: string;
    gender?: string;
    height?: string;
    weight?: string;
    nationality?: string;
    emiratesId?: string;
    passportNumber?: string;
    maritalStatus?: string;
    occupation?: string;
    address?: string;
    poBox?: string;
    sponsorName?: string;
    salary?: string;
  };
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
   * Pre-fill form data from lead and existing EMAF data
   * @param leadData - Lead data from lead service
   * @param existingEmafData - Existing EMAF submission data (if any)
   * @returns Prefilled form data structure
   */
  prefillFromLeadAndEmaf(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData
  ): PrefilledFormData {
    const prefilled: PrefilledFormData = {
      memberDetails: {},
      members: []
    };

    // If existing EMAF data exists, use it as base
    if (existingEmafData?.formData) {
      return this.mergeFormData(existingEmafData.formData, prefilled);
    }

    // Pre-fill from lead data
    if (leadData) {
      // Section 1: Member Details
      if (leadData.firstName || leadData.lastName) {
        prefilled.memberDetails.applicantName = 
          `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim();
      }

      if (leadData.email) {
        prefilled.memberDetails.email = leadData.email;
      }

      if (leadData.phone?.number) {
        const countryCode = leadData.phone.countryCode || '+971';
        prefilled.memberDetails.contactNumber = `${countryCode}${leadData.phone.number}`;
      }

      if (leadData.emirate) {
        prefilled.memberDetails.address = leadData.emirate;
      }

      if (leadData.lobData) {
        const lob = leadData.lobData;

        if (lob.emiratesId) {
          prefilled.memberDetails.emiratesId = lob.emiratesId;
        }

        if (lob.occupation) {
          prefilled.memberDetails.occupation = lob.occupation;
        }

        if (lob.address) {
          prefilled.memberDetails.address = lob.address;
        }

        if (lob.poBox) {
          prefilled.memberDetails.poBox = lob.poBox;
        }

        if (lob.sponsorName) {
          prefilled.memberDetails.sponsorName = lob.sponsorName;
        }

        if (lob.salary) {
          // Convert salary to expected format
          if (lob.salary.toLowerCase().includes('4000') || 
              lob.salary.toLowerCase().includes('up to') ||
              parseInt(lob.salary) <= 4000) {
            prefilled.memberDetails.salary = 'up_to_4000';
          } else {
            prefilled.memberDetails.salary = 'above_4000';
          }
        }

        // Section 3: Members (first member from lead data)
        if (lob.dateOfBirth || lob.gender || lob.nationality) {
          prefilled.members = [{
            name: prefilled.memberDetails.applicantName,
            nationality: lob.nationality,
            passportOrEmiratesId: lob.emiratesId || lob.passportNumber,
            relationship: 'Self',
            maritalStatus: lob.maritalStatus,
            dateOfBirth: lob.dateOfBirth,
            gender: lob.gender,
            height: lob.height,
            weight: lob.weight,
            visaEmirate: leadData.emirate
          }];
        }
      }

      // Set default relationship if not set
      if (!prefilled.memberDetails.relationship) {
        prefilled.memberDetails.relationship = 'Self';
      }
    }

    return prefilled;
  }

  /**
   * Merge existing form data with new pre-filled data
   * Existing data takes precedence
   */
  private mergeFormData(
    existing: Record<string, any>,
    prefilled: PrefilledFormData
  ): PrefilledFormData {
    return {
      memberDetails: {
        ...prefilled.memberDetails,
        ...existing.memberDetails
      },
      previousInsurance: {
        ...prefilled.previousInsurance,
        ...existing.previousInsurance
      },
      members: existing.members || prefilled.members || [],
      medicalHistory: existing.medicalHistory || prefilled.medicalHistory,
      specificMedicalHistory: existing.specificMedicalHistory || prefilled.specificMedicalHistory,
      yesAnswerDetails: existing.yesAnswerDetails || prefilled.yesAnswerDetails || [],
      signature: {
        ...prefilled.signature,
        ...existing.signature
      }
    };
  }

  /**
   * Pre-fill from multiple sources (lead, existing EMAF, customer profile)
   */
  prefillFromMultipleSources(
    leadData?: LeadData,
    existingEmafData?: ExistingEmafData,
    customerProfile?: any
  ): PrefilledFormData {
    // Start with lead data
    let prefilled = this.prefillFromLeadAndEmaf(leadData, existingEmafData);

    // Override with customer profile data if available
    if (customerProfile) {
      if (customerProfile.fullName && !prefilled.memberDetails.applicantName) {
        prefilled.memberDetails.applicantName = customerProfile.fullName;
      }
      if (customerProfile.email && !prefilled.memberDetails.email) {
        prefilled.memberDetails.email = customerProfile.email;
      }
      if (customerProfile.phone && !prefilled.memberDetails.contactNumber) {
        prefilled.memberDetails.contactNumber = customerProfile.phone;
      }
      if (customerProfile.emiratesId && !prefilled.memberDetails.emiratesId) {
        prefilled.memberDetails.emiratesId = customerProfile.emiratesId;
      }
    }

    return prefilled;
  }
}

export const dataPrefillService = new DataPrefillService();
