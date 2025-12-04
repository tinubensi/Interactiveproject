export type CustomerType = 'INDIVIDUAL' | 'COMPANY';
export type Priority = 'Low' | 'Medium' | 'High';
export type Gender = 'Male' | 'Female' | 'Other';
export type ContactType = 'email' | 'phone';

export interface IndividualCustomer {
  id: string;
  customerType: 'INDIVIDUAL';
  title?: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  name: string;
  dateOfBirth?: string;
  email: string;
  email2?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  faxNumber?: string;
  emiratesId?: string;
  nationality?: string;
  gender: string;
  address?: string;
  agent: string;
  placementExecutive?: string;
  customerTypeCategory: string;
  currency: string;
  mainCustomer?: string;
  insuredName?: string;
  creationDate: string;
  firstBusinessDate: string;
  documentStatus?: 'Complete' | 'Missing Documents' | 'Pending';
  policies?: string[];
  contacts?: Contact[];
  createdAt: string;
  updatedAt: string;
}

export interface CompanyCustomer {
  id: string;
  customerType: 'COMPANY';
  title?: string;
  companyName: string;
  tradeLicenseId?: string;
  email1: string;
  email2?: string;
  phoneNumber1: string;
  phoneNumber2?: string;
  faxNumber?: string;
  address?: string;
  address1?: string;
  poBox?: string;
  contactPerson?: string;
  agent: string;
  accountExecutive?: string;
  customerTypeCategory: string;
  creditLimit?: number;
  creditTerm?: number;
  monthlyIncome?: number;
  currency: string;
  trnNumber?: string;
  mainCustomer?: string;
  insuredName?: string;
  creationDate: string;
  firstBusinessDate: string;
  documentStatus?: 'Complete' | 'Missing Documents' | 'Pending';
  policies?: string[];
  contacts?: Contact[];
  createdAt: string;
  updatedAt: string;
}

export type Customer = IndividualCustomer | CompanyCustomer;

export interface Contact {
  type: ContactType;
  value: string;
  addedAt: string;
}

export interface OTPRecord {
  id: string;
  email: string;
  otp: string;
  expiresAt: number; // Unix timestamp
  createdAt: string;
  ttl: number; // TTL in seconds
}

export interface SignupRequest {
  customerType: CustomerType;
  // Individual fields
  title?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  name?: string;
  dateOfBirth?: string;
  email?: string;
  email2?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  faxNumber?: string;
  emiratesId?: string;
  nationality?: string;
  gender?: string;
  address?: string;
  agent?: string;
  placementExecutive?: string;
  customerTypeCategory?: string;
  currency?: string;
  mainCustomer?: string;
  insuredName?: string;
  // Company fields
  companyName?: string;
  tradeLicenseId?: string;
  email1?: string;
  phoneNumber1?: string;
  phoneNumber2?: string;
  address1?: string;
  poBox?: string;
  contactPerson?: string;
  accountExecutive?: string;
  creditLimit?: number;
  creditTerm?: number;
  monthlyIncome?: number;
  trnNumber?: string;
  creationDate?: string;
  firstBusinessDate?: string;
}

export interface LoginRequest {
  email: string;
}

export interface VerifyOTPRequest {
  email: string;
  otp: string;
}

export interface UpdateProfileRequest {
  companyName?: string;
  tradeLicense?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
}

export interface AddContactRequest {
  type: ContactType;
  value: string;
}

export interface CustomerCreatedEvent {
  id: string;
  customerType: CustomerType;
  profile: Partial<Customer>;
}

export interface CustomerProfileUpdatedEvent {
  id: string;
  updatedFields: string[];
}

export interface PolicyIssuedEvent {
  customerId: string;
  policyId: string;
  policyNumber: string;
}

export interface CustomerDocumentUploadedEvent {
  customerId: string;
  documentId: string;
}

export interface CustomerDocumentExpiredEvent {
  customerId: string;
  documentId: string;
}

