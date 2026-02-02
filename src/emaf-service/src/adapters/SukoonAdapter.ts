/**
 * Sukoon Vendor Adapter
 * Converts between Sukoon's nested structure and canonical model
 */

import { VendorAdapter } from './VendorAdapter';
import { UnifiedEmafData } from '../models/canonicalEmafTypes';

export class SukoonAdapter implements VendorAdapter {
  getVendorId(): string {
    return 'sukoon';
  }

  toCanonical(sukoonData: any): UnifiedEmafData {
    // Extract policy holder from memberDetails
    const policyHolder = {
      fullName: sukoonData.memberDetails?.applicantName || '',
      email: sukoonData.memberDetails?.email || '',
      phone: sukoonData.memberDetails?.contactNumber || '',
      emiratesId: sukoonData.memberDetails?.emiratesId,
      address: sukoonData.memberDetails?.address,
      poBox: sukoonData.memberDetails?.poBox,
      occupation: sukoonData.memberDetails?.occupation,
      sponsorName: sukoonData.memberDetails?.sponsorName,
      salary: sukoonData.memberDetails?.salary,
    };

    // Convert members array to insuredMembers
    const insuredMembers = (sukoonData.members || []).map((m: any, idx: number) => ({
      id: `member-${idx}`,
      type: this.mapRelationshipToType(m.relationship),
      name: m.name || '',
      relationship: m.relationship?.toLowerCase() || 'self',
      dateOfBirth: m.dateOfBirth,
      gender: m.gender?.toLowerCase() as 'male' | 'female' | undefined,
      maritalStatus: m.maritalStatus?.toLowerCase(),
      nationality: m.nationality,
      emiratesId: m.passportOrEmiratesId,
      passportNumber: m.passportOrEmiratesId,
      height: m.height ? parseFloat(String(m.height)) : undefined,
      weight: m.weight ? parseFloat(String(m.weight)) : undefined,
      visaEmirate: m.visaEmirate,
    }));

    // Map previous insurance
    const previousInsurance = {
      hasInsurance: sukoonData.previousInsurance?.hasInsurance || false,
      members: insuredMembers
        .filter((m: any) => sukoonData.previousInsurance?.policyNumber)
        .map((m: any) => ({
          memberId: m.id,
          policyNumber: sukoonData.previousInsurance?.policyNumber,
          expiryDate: sukoonData.previousInsurance?.expiryDate,
        })),
    };

    return {
      policyHolder,
      insuredMembers,
      previousInsurance,
      medicalHistory: sukoonData.medicalHistory,
      signature: sukoonData.signature,
    };
  }

  fromCanonical(canonical: UnifiedEmafData): any {
    return {
      memberDetails: {
        applicantName: canonical.policyHolder.fullName,
        email: canonical.policyHolder.email,
        contactNumber: canonical.policyHolder.phone,
        emiratesId: canonical.policyHolder.emiratesId,
        address: canonical.policyHolder.address,
        poBox: canonical.policyHolder.poBox,
        occupation: canonical.policyHolder.occupation,
        sponsorName: canonical.policyHolder.sponsorName,
        salary: canonical.policyHolder.salary,
        relationship: 'Self',
      },
      members: canonical.insuredMembers.map(m => ({
        name: m.name,
        nationality: m.nationality,
        passportOrEmiratesId: m.emiratesId || m.passportNumber,
        relationship: this.capitalizeFirst(m.relationship),
        maritalStatus: this.capitalizeFirst(m.maritalStatus),
        dateOfBirth: m.dateOfBirth,
        gender: this.capitalizeFirst(m.gender),
        height: m.height?.toString(),
        weight: m.weight?.toString(),
        visaEmirate: m.visaEmirate,
      })),
      previousInsurance: {
        hasInsurance: canonical.previousInsurance.hasInsurance,
        policyNumber: canonical.previousInsurance.members[0]?.policyNumber,
        expiryDate: canonical.previousInsurance.members[0]?.expiryDate,
      },
      medicalHistory: canonical.medicalHistory,
      signature: canonical.signature,
    };
  }

  private mapRelationshipToType(relationship?: string): 'principal' | 'spouse' | 'dependent' {
    const rel = relationship?.toLowerCase() || 'self';
    if (rel === 'self') return 'principal';
    if (rel === 'spouse') return 'spouse';
    return 'dependent';
  }

  private capitalizeFirst(str?: string): string | undefined {
    if (!str) return undefined;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }
}
