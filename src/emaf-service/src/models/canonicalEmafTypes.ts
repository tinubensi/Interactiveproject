/**
 * Canonical EMAF Data Types
 * Unified data structure that represents EMAF data vendor-agnostically
 * This is the single source of truth for EMAF form data
 */

export interface UnifiedEmafData {
  policyHolder: {
    fullName: string;
    email: string;
    phone: string;
    emiratesId?: string;
    nationality?: string;
    dateOfBirth?: string;
    gender?: 'male' | 'female';
    maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
    height?: number;
    weight?: number;
    emirate?: string;
    address?: string;
    poBox?: string;
    occupation?: string;
    sponsorName?: string;
    salary?: string;
    employer?: string;
  };
  
  insuredMembers: Array<{
    id: string;
    type: 'principal' | 'spouse' | 'dependent';
    name: string;
    relationship: 'self' | 'spouse' | 'child' | 'parent';
    dateOfBirth?: string;
    gender?: 'male' | 'female';
    maritalStatus?: string;
    nationality?: string;
    emiratesId?: string;
    passportNumber?: string;
    height?: number;
    weight?: number;
    visaEmirate?: string;
  }>;
  
  previousInsurance: {
    hasInsurance: boolean;
    members: Array<{
      memberId: string;
      insuranceCompany?: string;
      policyNumber?: string;
      expiryDate?: string;
    }>;
  };
  
  medicalHistory?: {
    generalQuestions?: Record<string, boolean>;
    specificConditions?: Record<string, boolean>;
    yesAnswerDetails?: Array<{
      questionId: string;
      memberId: string;
      details: string;
    }>;
  };
  
  signature?: {
    applicantName?: string;
    date?: string;
    emiratesId?: string;
    agreed?: boolean;
  };
}
