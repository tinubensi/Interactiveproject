/**
 * Static Plan Data
 * Pre-defined insurance plans for testing and initial deployment
 * RPA integration will replace this in production
 */

import { Plan, Vendor, LineOfBusiness } from '../models/plan';

// ==================== VENDORS ====================

export const STATIC_VENDORS: Omit<Vendor, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'vendor-adip',
    name: 'Al Dhafra Insurance',
    code: 'ADIP',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/adip.png',
    website: 'https://www.aldhafrainsurance.com',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 1
  },
  {
    id: 'vendor-oic',
    name: 'Oman Insurance Company',
    code: 'OIC',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/oic.png',
    website: 'https://www.omaninsurance.ae',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 2
  },
  {
    id: 'vendor-dic',
    name: 'Dubai Insurance Company',
    code: 'DIC',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/dic.png',
    website: 'https://www.dubaiins.ae',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 3
  }
];

// ==================== MEDICAL (PET) PLANS ====================

export const STATIC_MEDICAL_PLANS: Omit<Plan, 'id' | 'leadId' | 'fetchRequestId' | 'fetchedAt' | 'quotationId'>[] = [
  // Plan 1: Al Dhafra - Pet Care Essential
  {
    vendorId: 'vendor-adip',
    vendorName: 'Al Dhafra Insurance',
    vendorCode: 'ADIP',
    planName: 'Pet Care Essential',
    planCode: 'PET-ESS-001',
    planType: 'basic',
    annualPremium: 1500,
    monthlyPremium: 130,
    currency: 'AED',
    annualLimit: 50000,
    deductible: 500,
    deductibleMetric: 'AED',
    coInsurance: 20,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 14,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-medical',
        categoryName: 'Medical Coverage',
        benefits: [
          {
            name: 'Accident Treatment',
            covered: true,
            limit: 50000,
            limitMetric: 'AED',
            description: 'Coverage for injuries due to accidents'
          },
          {
            name: 'Illness Treatment',
            covered: true,
            limit: 30000,
            limitMetric: 'AED',
            description: 'Coverage for illness and diseases'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 25000,
            limitMetric: 'AED',
            description: 'Surgical procedures'
          },
          {
            name: 'Hospitalization',
            covered: true,
            limit: 20000,
            limitMetric: 'AED',
            description: 'Inpatient hospital stays'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive Care',
        benefits: [
          {
            name: 'Vaccinations',
            covered: true,
            limit: 500,
            limitMetric: 'AED',
            description: 'Annual vaccinations'
          },
          {
            name: 'Annual Checkup',
            covered: true,
            limit: 300,
            limitMetric: 'AED'
          },
          {
            name: 'Dental Cleaning',
            covered: false
          }
        ]
      },
      {
        categoryId: 'cat-additional',
        categoryName: 'Additional Benefits',
        benefits: [
          {
            name: 'Third Party Liability',
            covered: false
          },
          {
            name: 'Boarding Kennel',
            covered: false
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions',
      'Breeding and pregnancy',
      'Cosmetic procedures',
      'Behavioral issues',
      'Elective procedures'
    ],
    lineOfBusiness: 'medical',
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 2: Oman Insurance - Pet Care Premium
  {
    vendorId: 'vendor-oic',
    vendorName: 'Oman Insurance Company',
    vendorCode: 'OIC',
    planName: 'Pet Care Premium',
    planCode: 'PET-PREM-001',
    planType: 'premium',
    annualPremium: 2500,
    monthlyPremium: 220,
    currency: 'AED',
    annualLimit: 100000,
    deductible: 250,
    deductibleMetric: 'AED',
    coInsurance: 10,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 7,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-medical',
        categoryName: 'Medical Coverage',
        benefits: [
          {
            name: 'Accident Treatment',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Illness Treatment',
            covered: true,
            limit: 75000,
            limitMetric: 'AED'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 50000,
            limitMetric: 'AED'
          },
          {
            name: 'Hospitalization',
            covered: true,
            limit: 40000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 10000,
            limitMetric: 'AED',
            description: 'X-rays, blood tests, MRI, CT scans'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive Care',
        benefits: [
          {
            name: 'Vaccinations',
            covered: true,
            limit: 1000,
            limitMetric: 'AED'
          },
          {
            name: 'Annual Checkup',
            covered: true,
            limit: 500,
            limitMetric: 'AED'
          },
          {
            name: 'Dental Cleaning',
            covered: true,
            limit: 800,
            limitMetric: 'AED'
          },
          {
            name: 'Flea & Tick Prevention',
            covered: true,
            limit: 400,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-additional',
        categoryName: 'Additional Benefits',
        benefits: [
          {
            name: 'Third Party Liability',
            covered: true,
            limit: 50000,
            limitMetric: 'AED',
            description: 'Coverage for damages caused by your pet'
          },
          {
            name: 'Boarding Kennel',
            covered: true,
            limit: 2000,
            limitMetric: 'AED',
            description: 'If owner is hospitalized'
          },
          {
            name: 'Lost Pet Advertising',
            covered: true,
            limit: 500,
            limitMetric: 'AED'
          },
          {
            name: 'Death from Accident/Illness',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions',
      'Breeding and pregnancy',
      'Cosmetic procedures'
    ],
    lineOfBusiness: 'medical',
    isAvailable: true,
    isSelected: false,
    isRecommended: true, // Recommended plan
    source: 'static'
  },

  // Plan 3: Dubai Insurance - Pet Care Comprehensive
  {
    vendorId: 'vendor-dic',
    vendorName: 'Dubai Insurance Company',
    vendorCode: 'DIC',
    planName: 'Pet Care Comprehensive',
    planCode: 'PET-COMP-001',
    planType: 'comprehensive',
    annualPremium: 3500,
    monthlyPremium: 310,
    currency: 'AED',
    annualLimit: 150000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 0,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-medical',
        categoryName: 'Medical Coverage',
        benefits: [
          {
            name: 'Accident Treatment',
            covered: true,
            limit: 150000,
            limitMetric: 'AED'
          },
          {
            name: 'Illness Treatment',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 75000,
            limitMetric: 'AED'
          },
          {
            name: 'Hospitalization',
            covered: true,
            limit: 60000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 50000,
            limitMetric: 'AED'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Rehabilitation/Physical Therapy',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive Care',
        benefits: [
          {
            name: 'Vaccinations',
            covered: true,
            limit: 1500,
            limitMetric: 'AED'
          },
          {
            name: 'Annual Checkup',
            covered: true,
            limit: 1000,
            limitMetric: 'AED'
          },
          {
            name: 'Dental Cleaning',
            covered: true,
            limit: 1200,
            limitMetric: 'AED'
          },
          {
            name: 'Flea & Tick Prevention',
            covered: true,
            limit: 600,
            limitMetric: 'AED'
          },
          {
            name: 'Deworming',
            covered: true,
            limit: 400,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-additional',
        categoryName: 'Additional Benefits',
        benefits: [
          {
            name: 'Third Party Liability',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Boarding Kennel',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'Lost Pet Advertising',
            covered: true,
            limit: 1000,
            limitMetric: 'AED'
          },
          {
            name: 'Death from Accident/Illness',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          },
          {
            name: 'Travel Cover',
            covered: true,
            limit: 5000,
            limitMetric: 'AED',
            description: 'Coverage while traveling within UAE'
          },
          {
            name: 'Emergency Euthanasia',
            covered: true,
            limit: 2000,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions',
      'Breeding and pregnancy'
    ],
    lineOfBusiness: 'medical',
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  }
];

/**
 * Get static plans for a lead
 */
export function getStaticPlansForLead(
  leadId: string,
  lineOfBusiness: LineOfBusiness,
  businessType: string,
  leadData: any
): Plan[] {
  let basePlans: typeof STATIC_MEDICAL_PLANS = [];

  switch (lineOfBusiness) {
    case 'medical':
      basePlans = STATIC_MEDICAL_PLANS;
      break;
    case 'motor':
      // TODO: Add motor plans
      basePlans = [];
      break;
    case 'general':
      // TODO: Add general plans
      basePlans = [];
      break;
    case 'marine':
      // TODO: Add marine plans
      basePlans = [];
      break;
  }

  // Transform to Plan model with leadId and timestamps
  return basePlans.map((plan, index) => ({
    ...plan,
    id: `plan-${leadId}-${index + 1}`,
    leadId,
    fetchRequestId: '', // Will be set by caller
    fetchedAt: new Date(),
    lobSpecificData: {
      petType: leadData.petType,
      petAge: calculateAge(leadData.petBirthday),
      petBreed: leadData.petBreed
    }
  })) as Plan[];
}

/**
 * Calculate age from birthday
 */
function calculateAge(birthday: string): number {
  if (!birthday) return 0;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/**
 * Get vendors by LOB
 */
export function getVendorsByLOB(lineOfBusiness: LineOfBusiness): Omit<Vendor, 'createdAt' | 'updatedAt'>[] {
  return STATIC_VENDORS.filter(v => v.lineOfBusiness === lineOfBusiness);
}


