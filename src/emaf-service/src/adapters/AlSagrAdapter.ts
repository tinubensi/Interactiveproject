/**
 * Al Sagr Vendor Adapter
 * Converts between Al Sagr's flat structure and canonical model
 */

import { VendorAdapter } from './VendorAdapter';
import { UnifiedEmafData } from '../models/canonicalEmafTypes';

export class AlSagrAdapter implements VendorAdapter {
  getVendorId(): string {
    return 'alsagr';
  }

  toCanonical(alsagrData: any): UnifiedEmafData {
    const policyHolder = {
      fullName: alsagrData.policyHolder_fullName || '',
      email: alsagrData.policyHolder_email || '',
      phone: alsagrData.policyHolder_mobile || alsagrData.policyHolder_contactNumber || '',
      emiratesId: alsagrData.policyHolder_emiratesId,
      nationality: alsagrData.policyHolder_nationality,
      dateOfBirth: alsagrData.policyHolder_dob,
      gender: alsagrData.policyHolder_gender as 'male' | 'female' | undefined,
      maritalStatus: alsagrData.policyHolder_maritalStatus as 'single' | 'married' | 'divorced' | 'widowed' | undefined,
      height: alsagrData.policyHolder_height ? parseFloat(String(alsagrData.policyHolder_height)) : undefined,
      weight: alsagrData.policyHolder_weight ? parseFloat(String(alsagrData.policyHolder_weight)) : undefined,
      emirate: alsagrData.policyHolder_emirate,
      address: alsagrData.policyHolder_location,
      occupation: alsagrData.policyHolder_occupation,
      salary: alsagrData.policyHolder_salary,
      employer: alsagrData.policyHolder_employer,
    };

    const insuredMembers: Array<{
      id: string;
      type: 'principal' | 'spouse' | 'dependent';
      name: string;
      relationship: 'self' | 'spouse' | 'child' | 'parent';
      dateOfBirth?: string;
      gender?: 'male' | 'female';
      maritalStatus?: string;
      height?: number;
      weight?: number;
    }> = [];

    // Add principal
    if (alsagrData.principal_name) {
      insuredMembers.push({
        id: 'principal',
        type: 'principal',
        name: alsagrData.principal_name,
        relationship: 'self',
        dateOfBirth: alsagrData.principal_dob,
        gender: alsagrData.principal_gender as 'male' | 'female' | undefined,
        maritalStatus: alsagrData.principal_maritalStatus,
        height: alsagrData.principal_height ? parseFloat(String(alsagrData.principal_height)) : undefined,
        weight: alsagrData.principal_weight ? parseFloat(String(alsagrData.principal_weight)) : undefined,
      });
    }

    // Add spouse
    if (alsagrData.spouse_name) {
      insuredMembers.push({
        id: 'spouse',
        type: 'spouse',
        name: alsagrData.spouse_name,
        relationship: 'spouse',
        dateOfBirth: alsagrData.spouse_dob,
        gender: alsagrData.spouse_gender as 'male' | 'female' | undefined,
        maritalStatus: alsagrData.spouse_maritalStatus,
        height: alsagrData.spouse_height ? parseFloat(String(alsagrData.spouse_height)) : undefined,
        weight: alsagrData.spouse_weight ? parseFloat(String(alsagrData.spouse_weight)) : undefined,
      });
    }

    // Add dependents (1-5)
    for (let i = 1; i <= 5; i++) {
      if (alsagrData[`dependent${i}_name`]) {
        insuredMembers.push({
          id: `dependent-${i}`,
          type: 'dependent',
          name: alsagrData[`dependent${i}_name`],
          relationship: (alsagrData[`dependent${i}_relation`] || 'child') as 'self' | 'spouse' | 'child' | 'parent',
          dateOfBirth: alsagrData[`dependent${i}_dob`],
          gender: alsagrData[`dependent${i}_gender`] as 'male' | 'female' | undefined,
          maritalStatus: alsagrData[`dependent${i}_maritalStatus`],
        });
      }
    }

    // Map previous insurance
    const previousInsuranceMembers: Array<{
      memberId: string;
      insuranceCompany?: string;
      policyNumber?: string;
      expiryDate?: string;
    }> = [];
    
    if (alsagrData.principal_prevInsuranceCompany) {
      previousInsuranceMembers.push({
        memberId: 'principal',
        insuranceCompany: alsagrData.principal_prevInsuranceCompany,
        expiryDate: alsagrData.principal_prevPolicyExpiry,
      });
    }
    if (alsagrData.spouse_prevInsuranceCompany) {
      previousInsuranceMembers.push({
        memberId: 'spouse',
        insuranceCompany: alsagrData.spouse_prevInsuranceCompany,
        expiryDate: alsagrData.spouse_prevPolicyExpiry,
      });
    }

    return {
      policyHolder,
      insuredMembers,
      previousInsurance: {
        hasInsurance: previousInsuranceMembers.length > 0,
        members: previousInsuranceMembers,
      },
    };
  }

  fromCanonical(canonical: UnifiedEmafData): any {
    const result: any = {
      policyHolder_fullName: canonical.policyHolder.fullName,
      policyHolder_email: canonical.policyHolder.email,
      policyHolder_mobile: canonical.policyHolder.phone,
      policyHolder_contactNumber: canonical.policyHolder.phone,
      policyHolder_emiratesId: canonical.policyHolder.emiratesId,
      policyHolder_nationality: canonical.policyHolder.nationality,
      policyHolder_dob: canonical.policyHolder.dateOfBirth,
      policyHolder_gender: canonical.policyHolder.gender,
      policyHolder_maritalStatus: canonical.policyHolder.maritalStatus,
      policyHolder_height: canonical.policyHolder.height?.toString(),
      policyHolder_weight: canonical.policyHolder.weight?.toString(),
      policyHolder_emirate: canonical.policyHolder.emirate,
      policyHolder_location: canonical.policyHolder.address,
      policyHolder_occupation: canonical.policyHolder.occupation,
      policyHolder_salary: canonical.policyHolder.salary,
      policyHolder_employer: canonical.policyHolder.employer,
    };

    // Map principal
    const principal = canonical.insuredMembers.find(m => m.type === 'principal');
    if (principal) {
      result.principal_name = principal.name;
      result.principal_relation = 'self';
      result.principal_dob = principal.dateOfBirth;
      result.principal_gender = principal.gender;
      result.principal_maritalStatus = principal.maritalStatus;
      result.principal_height = principal.height?.toString();
      result.principal_weight = principal.weight?.toString();
      
      const principalInsurance = canonical.previousInsurance.members.find(m => m.memberId === principal.id);
      if (principalInsurance) {
        result.principal_prevInsuranceCompany = principalInsurance.insuranceCompany;
        result.principal_prevPolicyExpiry = principalInsurance.expiryDate;
      }
    }

    // Map spouse
    const spouse = canonical.insuredMembers.find(m => m.type === 'spouse');
    if (spouse) {
      result.spouse_name = spouse.name;
      result.spouse_relation = 'spouse';
      result.spouse_dob = spouse.dateOfBirth;
      result.spouse_gender = spouse.gender;
      result.spouse_maritalStatus = spouse.maritalStatus;
      result.spouse_height = spouse.height?.toString();
      result.spouse_weight = spouse.weight?.toString();
      
      const spouseInsurance = canonical.previousInsurance.members.find(m => m.memberId === spouse.id);
      if (spouseInsurance) {
        result.spouse_prevInsuranceCompany = spouseInsurance.insuranceCompany;
        result.spouse_prevPolicyExpiry = spouseInsurance.expiryDate;
      }
    }

    // Map dependents
    const dependents = canonical.insuredMembers.filter(m => m.type === 'dependent');
    dependents.forEach((dep, idx) => {
      const num = idx + 1;
      result[`dependent${num}_name`] = dep.name;
      result[`dependent${num}_relation`] = dep.relationship;
      result[`dependent${num}_dob`] = dep.dateOfBirth;
      result[`dependent${num}_gender`] = dep.gender;
      result[`dependent${num}_maritalStatus`] = dep.maritalStatus;
    });

    return result;
  }
}
