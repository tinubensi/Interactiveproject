/**
 * Static Plan Data
 * Pre-defined insurance plans for testing and initial deployment
 * RPA integration will replace this in production
 */

import { Plan, Vendor, LineOfBusiness, PremiumItem } from '../models/plan';

// ==================== VENDORS ====================

export const STATIC_VENDORS: Omit<Vendor, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'vendor-takaful',
    name: 'Takaful Emarat',
    code: 'TAKAFUL',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/takaful.png',
    website: 'https://www.takafulemarat.ae',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 1
  },
  {
    id: 'vendor-daman',
    name: 'Daman',
    code: 'DAMAN',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/daman.png',
    website: 'https://www.damanhealth.ae',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 2
  },
  {
    id: 'vendor-nextcare',
    name: 'Nextcare',
    code: 'NEXTCARE',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/nextcare.png',
    website: 'https://www.nextcare.com',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 3
  },
  {
    id: 'vendor-adnic',
    name: 'Abu Dhabi National Insurance Company',
    code: 'ADNIC',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/adnic.png',
    website: 'https://www.adnic.ae',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 4
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
    priority: 5
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
    priority: 6
  },
  {
    id: 'vendor-alsagr',
    name: 'Al Sagr National Insurance',
    code: 'ALSAGR',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/alsagr.png',
    website: 'https://www.alsagr.ae',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 7
  },
  {
    id: 'vendor-metlife',
    name: 'MetLife (Alico)',
    code: 'METLIFE',
    lineOfBusiness: 'medical',
    logo: 'https://example.com/logos/metlife.png',
    website: 'https://www.metlife-gulf.com',
    rpaEnabled: false,
    hasStaticPlans: true,
    isActive: true,
    priority: 8
  }
];

// ==================== MEDICAL (HUMAN) PLANS ====================

export const STATIC_MEDICAL_PLANS: Omit<Plan, 'id' | 'leadId' | 'fetchRequestId' | 'fetchedAt' | 'quotationId'>[] = [
  
  // Plan 1: Takaful Emarat - Ecare Blue 1 (Essential)
  {
    vendorId: 'vendor-takaful',
    vendorName: 'Takaful Emarat',
    vendorCode: 'TAKAFUL',
    planName: 'Takaful Emarat - Ecare Blue 1',
    planCode: 'TK-ECB1-2024',
    planType: 'essential',
    annualPremium: 2030,
    monthlyPremium: 169,
    currency: 'AED',
    annualLimit: 150000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 20,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 30,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 150000,
            limitMetric: 'AED',
            description: 'Semi-private room coverage'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 150000,
            limitMetric: 'AED',
            description: 'All necessary surgical procedures'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 150000,
            limitMetric: 'AED',
            description: 'Intensive care unit coverage'
          },
          {
            name: 'Emergency Room',
            covered: true,
            limit: 150000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 15000,
            limitMetric: 'AED',
            description: '20% copay applies'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 15000,
            limitMetric: 'AED',
            description: '20% copay applies'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 15000,
            limitMetric: 'AED',
            description: 'Lab tests, X-rays with 20% copay'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 15000,
            limitMetric: 'AED',
            description: '20% copay on medications'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Maternity Coverage',
            covered: false
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: false
          },
          {
            name: 'Optical Coverage',
            covered: false
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions (12-month waiting period)',
      'Cosmetic procedures',
      'Experimental treatments',
      'Dental and optical (unless emergency)'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'eCare Blue',
      areaOfCover: 'Worldwide',
      copayTestMedicine: '20% Copay',
      copayConsultation: '20% Max AED 25'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: true,
    source: 'static'
  },

  // Plan 2: Daman - Essential Plus
  {
    vendorId: 'vendor-daman',
    vendorName: 'Daman',
    vendorCode: 'DAMAN',
    planName: 'Daman - Essential Plus',
    planCode: 'DM-ESS-PLUS-2024',
    planType: 'essential',
    annualPremium: 3500,
    monthlyPremium: 292,
    currency: 'AED',
    annualLimit: 250000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 10,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 30,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 250000,
            limitMetric: 'AED',
            description: 'Semi-private room'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 250000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 250000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 250000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 1000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 25000,
            limitMetric: 'AED',
            description: 'AED 20 copay per visit'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 25000,
            limitMetric: 'AED',
            description: 'AED 20 copay per visit'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 25000,
            limitMetric: 'AED',
            description: '10% copay'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 25000,
            limitMetric: 'AED',
            description: '10% copay'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Maternity Coverage',
            covered: false,
            description: 'Available as addon'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive Care',
        benefits: [
          {
            name: 'Annual Health Checkup',
            covered: true,
            limit: 500,
            limitMetric: 'AED'
          },
          {
            name: 'Vaccinations',
            covered: true,
            limit: 500,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions (12-month waiting period)',
      'Cosmetic procedures',
      'Dental (except emergencies)',
      'Fertility treatments'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Daman Network',
      areaOfCover: 'UAE',
      copayTestMedicine: '10% Copay',
      copayConsultation: 'AED 20'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 3: Nextcare - Silver Network
  {
    vendorId: 'vendor-nextcare',
    vendorName: 'Nextcare',
    vendorCode: 'NEXTCARE',
    planName: 'Nextcare - Silver Network',
    planCode: 'NC-SILVER-2024',
    planType: 'silver',
    annualPremium: 4850,
    monthlyPremium: 404,
    currency: 'AED',
    annualLimit: 300000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 10,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 30,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 300000,
            limitMetric: 'AED',
            description: 'Private room'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 300000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 300000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 300000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 1500,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 35000,
            limitMetric: 'AED',
            description: 'AED 15 copay'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 35000,
            limitMetric: 'AED',
            description: 'AED 20 copay'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 35000,
            limitMetric: 'AED',
            description: '10% copay'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 35000,
            limitMetric: 'AED',
            description: '10% copay'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 3000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 7000,
            limitMetric: 'AED',
            description: '12-month waiting period'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 10000,
            limitMetric: 'AED',
            description: '12-month waiting period'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental Coverage',
        benefits: [
          {
            name: 'Basic Dental',
            covered: true,
            limit: 1000,
            limitMetric: 'AED',
            description: 'Cleanings, fillings'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions (9-month waiting period)',
      'Cosmetic procedures',
      'Fertility treatments'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'NextCare Network',
      areaOfCover: 'UAE & GCC',
      copayTestMedicine: '10% Copay',
      copayConsultation: 'AED 15-20'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 4: ADNIC - Gold Comprehensive
  {
    vendorId: 'vendor-adnic',
    vendorName: 'Abu Dhabi National Insurance Company',
    vendorCode: 'ADNIC',
    planName: 'ADNIC - Gold Comprehensive',
    planCode: 'AD-GOLD-2024',
    planType: 'gold',
    annualPremium: 6200,
    monthlyPremium: 517,
    currency: 'AED',
    annualLimit: 500000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 30,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 500000,
            limitMetric: 'AED',
            description: 'Private room'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 500000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 500000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 500000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 2000,
            limitMetric: 'AED'
          },
          {
            name: 'Home Healthcare',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 50000,
            limitMetric: 'AED',
            description: 'No copay'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 50000,
            limitMetric: 'AED',
            description: 'No copay'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 50000,
            limitMetric: 'AED'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 50000,
            limitMetric: 'AED'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Pre & Post Natal Care',
            covered: true,
            limit: 3000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: true,
            limit: 2000,
            limitMetric: 'AED'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 500,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions (6-month waiting period)',
      'Cosmetic procedures'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'ADNIC Network',
      areaOfCover: 'Worldwide excl. USA',
      copayTestMedicine: 'No Copay',
      copayConsultation: 'No Copay'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: true,
    source: 'static'
  },

  // Plan 5: Dubai Insurance - Platinum Elite
  {
    vendorId: 'vendor-dic',
    vendorName: 'Dubai Insurance Company',
    vendorCode: 'DIC',
    planName: 'Dubai Insurance - Platinum Elite',
    planCode: 'DIC-PLAT-2024',
    planType: 'platinum',
    annualPremium: 8500,
    monthlyPremium: 708,
    currency: 'AED',
    annualLimit: 750000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 0,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 750000,
            limitMetric: 'AED',
            description: 'Suite room'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 750000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 750000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 750000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 3000,
            limitMetric: 'AED'
          },
          {
            name: 'Home Healthcare',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          },
          {
            name: 'Cancer Treatment',
            covered: true,
            limit: 750000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 75000,
            limitMetric: 'AED',
            description: 'Unlimited visits'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 75000,
            limitMetric: 'AED',
            description: 'Unlimited visits'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 75000,
            limitMetric: 'AED'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 75000,
            limitMetric: 'AED'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          },
          {
            name: 'Mental Health',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'Pre & Post Natal Care',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'Newborn Care',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: true,
            limit: 3000,
            limitMetric: 'AED'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 1000,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Cosmetic procedures'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Premier Network',
      areaOfCover: 'Worldwide',
      copayTestMedicine: 'No Copay',
      copayConsultation: 'No Copay'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 6: Oman Insurance - Premium Care
  {
    vendorId: 'vendor-oic',
    vendorName: 'Oman Insurance Company',
    vendorCode: 'OIC',
    planName: 'Oman Insurance - Premium Care',
    planCode: 'OIC-PREM-2024',
    planType: 'gold',
    annualPremium: 5750,
    monthlyPremium: 479,
    currency: 'AED',
    annualLimit: 400000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 10,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 30,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 400000,
            limitMetric: 'AED',
            description: 'Private room'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 400000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 400000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 400000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 1500,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 40000,
            limitMetric: 'AED',
            description: 'AED 20 copay'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 40000,
            limitMetric: 'AED',
            description: 'AED 25 copay'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 40000,
            limitMetric: 'AED',
            description: '10% copay'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 40000,
            limitMetric: 'AED',
            description: '10% copay'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 4000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 8000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 12000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: true,
            limit: 1500,
            limitMetric: 'AED'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 500,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions (9-month waiting period)',
      'Cosmetic procedures'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Oman Network',
      areaOfCover: 'GCC Countries',
      copayTestMedicine: '10% Copay',
      copayConsultation: 'AED 20-25'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 7: Al Sagr - Family Health Plus
  {
    vendorId: 'vendor-alsagr',
    vendorName: 'Al Sagr National Insurance',
    vendorCode: 'ALSAGR',
    planName: 'Al Sagr - Family Health Plus',
    planCode: 'AS-FAM-2024',
    planType: 'gold',
    annualPremium: 7300,
    monthlyPremium: 608,
    currency: 'AED',
    annualLimit: 600000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 30,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 600000,
            limitMetric: 'AED',
            description: 'Private room'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 600000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 600000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 600000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 2500,
            limitMetric: 'AED'
          },
          {
            name: 'Home Healthcare',
            covered: true,
            limit: 7500,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 60000,
            limitMetric: 'AED'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 60000,
            limitMetric: 'AED'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 60000,
            limitMetric: 'AED'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 60000,
            limitMetric: 'AED'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 6000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 12000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 18000,
            limitMetric: 'AED'
          },
          {
            name: 'Pre & Post Natal Care',
            covered: true,
            limit: 4000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: true,
            limit: 2500,
            limitMetric: 'AED'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 750,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Pre-existing conditions (6-month waiting period)',
      'Cosmetic procedures'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Al Sagr Network',
      areaOfCover: 'Worldwide excl. USA',
      copayTestMedicine: 'No Copay',
      copayConsultation: 'No Copay'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 8: MetLife - Superior Plan
  {
    vendorId: 'vendor-metlife',
    vendorName: 'MetLife (Alico)',
    vendorCode: 'METLIFE',
    planName: 'MetLife - Superior Plan',
    planCode: 'ML-SUP-2024',
    planType: 'platinum',
    annualPremium: 9800,
    monthlyPremium: 817,
    currency: 'AED',
    annualLimit: 1000000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 0,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 1000000,
            limitMetric: 'AED',
            description: 'VIP Suite'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 1000000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 1000000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 1000000,
            limitMetric: 'AED'
          },
          {
            name: 'Ambulance Services',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'Home Healthcare',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Cancer Treatment',
            covered: true,
            limit: 1000000,
            limitMetric: 'AED'
          },
          {
            name: 'Organ Transplant',
            covered: true,
            limit: 500000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Mental Health',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          },
          {
            name: 'Pre & Post Natal Care',
            covered: true,
            limit: 8000,
            limitMetric: 'AED'
          },
          {
            name: 'Newborn Care',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Fertility Treatment',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 1500,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive & Wellness',
        benefits: [
          {
            name: 'Annual Health Screening',
            covered: true,
            limit: 2000,
            limitMetric: 'AED'
          },
          {
            name: 'Vaccinations',
            covered: true,
            limit: 1000,
            limitMetric: 'AED'
          },
          {
            name: 'Health & Wellness Programs',
            covered: true,
            limit: 1500,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [
      'Cosmetic procedures (unless medically necessary)'
    ],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Global Provider Network',
      areaOfCover: 'Worldwide',
      copayTestMedicine: 'No Copay',
      copayConsultation: 'No Copay'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: true,
    source: 'static'
  },

  // Plan 9: Takaful Emarat - Global Coverage
  {
    vendorId: 'vendor-takaful',
    vendorName: 'Takaful Emarat',
    vendorCode: 'TAKAFUL',
    planName: 'Takaful Emarat - Global Coverage',
    planCode: 'TK-GLOB-2024',
    planType: 'platinum',
    annualPremium: 12000,
    monthlyPremium: 1000,
    currency: 'AED',
    annualLimit: 1500000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 0,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 1500000,
            limitMetric: 'AED',
            description: 'Presidential Suite'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 1500000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 1500000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 1500000,
            limitMetric: 'AED'
          },
          {
            name: 'Air Ambulance',
            covered: true,
            limit: 50000,
            limitMetric: 'AED'
          },
          {
            name: 'Home Healthcare',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'Cancer Treatment',
            covered: true,
            limit: 1500000,
            limitMetric: 'AED'
          },
          {
            name: 'Organ Transplant',
            covered: true,
            limit: 750000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 150000,
            limitMetric: 'AED'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 150000,
            limitMetric: 'AED'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 150000,
            limitMetric: 'AED'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 150000,
            limitMetric: 'AED'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'Mental Health',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Alternative Medicine',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 25000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 35000,
            limitMetric: 'AED'
          },
          {
            name: 'Pre & Post Natal Care',
            covered: true,
            limit: 10000,
            limitMetric: 'AED'
          },
          {
            name: 'Newborn Care',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'Fertility Treatment',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Dental Coverage',
            covered: true,
            limit: 7500,
            limitMetric: 'AED'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 2000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive & Wellness',
        benefits: [
          {
            name: 'Executive Health Screening',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'Vaccinations',
            covered: true,
            limit: 2000,
            limitMetric: 'AED'
          },
          {
            name: 'Wellness Programs',
            covered: true,
            limit: 3000,
            limitMetric: 'AED'
          }
        ]
      }
    ],
    exclusions: [],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Global Premier Network',
      areaOfCover: 'Worldwide Including USA',
      copayTestMedicine: 'No Copay',
      copayConsultation: 'No Copay'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: false,
    source: 'static'
  },

  // Plan 10: Daman - Platinum Worldwide
  {
    vendorId: 'vendor-daman',
    vendorName: 'Daman',
    vendorCode: 'DAMAN',
    planName: 'Daman - Platinum Worldwide',
    planCode: 'DM-PLAT-WW-2024',
    planType: 'platinum',
    annualPremium: 14500,
    monthlyPremium: 1208,
    currency: 'AED',
    annualLimit: 2000000,
    deductible: 0,
    deductibleMetric: 'AED',
    coInsurance: 0,
    coInsuranceMetric: 'percentage',
    waitingPeriod: 0,
    waitingPeriodMetric: 'days',
    benefits: [
      {
        categoryId: 'cat-inpatient',
        categoryName: 'Inpatient Coverage',
        benefits: [
          {
            name: 'Hospital Room & Board',
            covered: true,
            limit: 2000000,
            limitMetric: 'AED',
            description: 'Royal Suite - Unlimited coverage'
          },
          {
            name: 'Surgery',
            covered: true,
            limit: 2000000,
            limitMetric: 'AED'
          },
          {
            name: 'ICU/CCU',
            covered: true,
            limit: 2000000,
            limitMetric: 'AED'
          },
          {
            name: 'Emergency Care',
            covered: true,
            limit: 2000000,
            limitMetric: 'AED'
          },
          {
            name: 'Air Ambulance',
            covered: true,
            limit: 100000,
            limitMetric: 'AED',
            description: 'Worldwide coverage'
          },
          {
            name: 'Home Healthcare',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          },
          {
            name: 'Cancer Treatment',
            covered: true,
            limit: 2000000,
            limitMetric: 'AED',
            description: 'Including treatment abroad'
          },
          {
            name: 'Organ Transplant',
            covered: true,
            limit: 1000000,
            limitMetric: 'AED'
          },
          {
            name: 'Chronic Disease Management',
            covered: true,
            limit: 2000000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-outpatient',
        categoryName: 'Outpatient Coverage',
        benefits: [
          {
            name: 'GP Consultation',
            covered: true,
            limit: 200000,
            limitMetric: 'AED',
            description: 'Unlimited visits'
          },
          {
            name: 'Specialist Consultation',
            covered: true,
            limit: 200000,
            limitMetric: 'AED',
            description: 'Unlimited visits'
          },
          {
            name: 'Diagnostic Tests',
            covered: true,
            limit: 200000,
            limitMetric: 'AED'
          },
          {
            name: 'Pharmacy',
            covered: true,
            limit: 200000,
            limitMetric: 'AED'
          },
          {
            name: 'Physiotherapy',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          },
          {
            name: 'Mental Health',
            covered: true,
            limit: 20000,
            limitMetric: 'AED'
          },
          {
            name: 'Alternative Medicine',
            covered: true,
            limit: 10000,
            limitMetric: 'AED',
            description: 'Acupuncture, Chiropractic'
          }
        ]
      },
      {
        categoryId: 'cat-maternity',
        categoryName: 'Maternity Coverage',
        benefits: [
          {
            name: 'Normal Delivery',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          },
          {
            name: 'C-Section',
            covered: true,
            limit: 45000,
            limitMetric: 'AED'
          },
          {
            name: 'Pre & Post Natal Care',
            covered: true,
            limit: 15000,
            limitMetric: 'AED'
          },
          {
            name: 'Newborn Care',
            covered: true,
            limit: 30000,
            limitMetric: 'AED'
          },
          {
            name: 'Fertility Treatment',
            covered: true,
            limit: 50000,
            limitMetric: 'AED'
          },
          {
            name: 'High-Risk Pregnancy',
            covered: true,
            limit: 100000,
            limitMetric: 'AED'
          }
        ]
      },
      {
        categoryId: 'cat-dental',
        categoryName: 'Dental & Optical',
        benefits: [
          {
            name: 'Comprehensive Dental',
            covered: true,
            limit: 10000,
            limitMetric: 'AED',
            description: 'Including orthodontics'
          },
          {
            name: 'Optical Coverage',
            covered: true,
            limit: 3000,
            limitMetric: 'AED',
            description: 'Including LASIK surgery'
          }
        ]
      },
      {
        categoryId: 'cat-preventive',
        categoryName: 'Preventive & Wellness',
        benefits: [
          {
            name: 'Platinum Health Assessment',
            covered: true,
            limit: 10000,
            limitMetric: 'AED',
            description: 'Annual comprehensive screening'
          },
          {
            name: 'All Vaccinations',
            covered: true,
            limit: 5000,
            limitMetric: 'AED'
          },
          {
            name: 'Wellness & Fitness',
            covered: true,
            limit: 5000,
            limitMetric: 'AED',
            description: 'Gym membership, nutrition counseling'
          },
          {
            name: 'Second Medical Opinion',
            covered: true,
            limit: 10000,
            limitMetric: 'AED',
            description: 'International expert consultation'
          }
        ]
      }
    ],
    exclusions: [],
    lineOfBusiness: 'medical',
    lobSpecificData: {
      networkProviders: 'Daman Elite Worldwide',
      areaOfCover: 'Worldwide Including USA',
      copayTestMedicine: 'No Copay',
      copayConsultation: 'No Copay'
    },
    isAvailable: true,
    isSelected: false,
    isRecommended: true,
    source: 'static'
  }
];

// ==================== PREMIUM CALCULATION LOGIC ====================

/**
 * Calculate age from birthday
 */
function calculateAge(birthday: string): number | null {
  if (!birthday || typeof birthday !== 'string' || birthday.trim() === '') {
    return null;
  }
  
  try {
    const birthDate = new Date(birthday);
    
    // Check if date is valid
    if (isNaN(birthDate.getTime())) {
      console.warn(`[calculateAge] Invalid date format: ${birthday}`);
      return null;
    }
    
    // Check if date is not in the future
    const today = new Date();
    if (birthDate > today) {
      console.warn(`[calculateAge] Date is in the future: ${birthday}`);
      return null;
    }
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    // Validate age is reasonable (0-150)
    if (age < 0 || age > 150) {
      console.warn(`[calculateAge] Calculated age is out of range: ${age} for DOB: ${birthday}`);
      return null;
    }
    
    return age;
  } catch (error) {
    console.warn(`[calculateAge] Error calculating age from ${birthday}:`, error);
    return null;
  }
}

/**
 * Extract premium items from lead data based on LOB
 */
function extractPremiumItems(
  leadData: any,
  lineOfBusiness: LineOfBusiness
): PremiumItem[] {
  switch (lineOfBusiness) {
    case 'medical':
      return extractMedicalMembers(leadData);
    case 'motor':
      return extractMotorVehicles(leadData);
    case 'marine':
    case 'general':
    default:
      return extractSingleItem(leadData);
  }
}

/**
 * Extract medical insurance members (primary + family members)
 * Supports both old format (members/familyMembers) and new format (repeatable sections)
 */
function extractMedicalMembers(leadData: any): PremiumItem[] {
  const items: PremiumItem[] = [];
  
  // Primary member
  // Always calculate age from DOB if available (more accurate than stored age)
  const primaryDOB = leadData.dateOfBirth || leadData.dateofbirth || leadData.dob;
  let primaryAge = null;
  
  if (primaryDOB) {
    primaryAge = calculateAge(primaryDOB);
    console.log(`[extractMedicalMembers] Primary DOB: ${primaryDOB}, Calculated age: ${primaryAge}`);
  }
  
  // Fallback to stored age or default
  if (primaryAge === null) {
    primaryAge = leadData.age || 30;
    console.log(`[extractMedicalMembers] Using stored/default age for primary: ${primaryAge}`);
  }
  
  items.push({
    itemId: 'primary',
    itemType: 'person',
    itemName: `${leadData.firstName || ''} ${leadData.lastName || ''}`.trim() || 'Primary Member',
    itemDetails: {
      age: primaryAge,
      gender: (leadData.gender || 'male').toLowerCase(),
      dateOfBirth: primaryDOB
    },
    isPrimary: true,
    annualPremium: 0,  // Will be calculated
    monthlyPremium: 0
  });
  
  // Find members from repeatable sections or old format
  let members: any[] = [];
  
  // Check for old format first
  if (leadData.members && Array.isArray(leadData.members)) {
    members = leadData.members;
  } else if (leadData.familyMembers && Array.isArray(leadData.familyMembers)) {
    members = leadData.familyMembers;
  } else {
    // Check for repeatable sections (new format)
    // Look for keys that might be section IDs containing member data
    // Common patterns: section-member-info, member-info, members, etc.
    const sectionKeys = Object.keys(leadData).filter(key => 
      !key.startsWith('_') && 
      Array.isArray(leadData[key]) && 
      leadData[key].length > 0 &&
      typeof leadData[key][0] === 'object'
    );
    
    // Find the most likely member section (contains age, gender, name, etc.)
    for (const sectionKey of sectionKeys) {
      const sectionData = leadData[sectionKey];
      if (Array.isArray(sectionData) && sectionData.length > 0) {
        const firstItem = sectionData[0];
        // Check if this looks like member data (has age, gender, name, dateOfBirth, etc.)
        if (firstItem.age || firstItem.dateOfBirth || firstItem.gender || 
            firstItem.memberName || firstItem.name || firstItem.firstName) {
          members = sectionData;
          break;
        }
      }
    }
  }
  
  // Process members
  members.forEach((member: any, idx: number) => {
    // Extract name from various possible fields - try all keys that might contain a name
    let memberName = null;
    
    // Try common name field patterns
    const nameFields = ['name', 'memberName', 'fullName', 'customerName', 'memberName'];
    for (const field of nameFields) {
      if (member[field] && typeof member[field] === 'string' && member[field].trim()) {
        memberName = member[field].trim();
        break;
      }
    }
    
    // Try combining first + last name
    if (!memberName) {
      const firstName = member.firstName || member.first_name || '';
      const lastName = member.lastName || member.last_name || '';
      const combined = `${firstName} ${lastName}`.trim();
      if (combined) {
        memberName = combined;
      }
    }
    
    // If still no name, check all string fields that look like names
    if (!memberName) {
      for (const [key, value] of Object.entries(member)) {
        if (typeof value === 'string' && value.trim()) {
          // Check if this looks like a name (not a date, number, gender, or short code)
          if (value.length > 2 && value.length < 100 && 
              !/^\d+$/.test(value) && 
              !/^\d{4}-\d{2}-\d{2}/.test(value) &&
              !['male', 'female', 'm', 'f', 'other'].includes(value.toLowerCase()) &&
              !key.toLowerCase().includes('email') &&
              !key.toLowerCase().includes('phone')) {
            memberName = value.trim();
            break;
          }
        }
      }
    }
    
    // Final fallback
    if (!memberName) {
      memberName = `Member ${idx + 1}`;
    }
    
    // Extract DOB - check all possible field name patterns
    let memberDOB = null;
    
    // Try common DOB field names
    const dobFields = [
      'dateOfBirth', 'dateofbirth', 'dob', 'birthDate', 'birthdate',
      'date_of_birth', 'dateOfBirth', 'memberDateOfBirth', 'memberDOB',
      'birthday', 'birthDay', 'memberBirthday'
    ];
    
    for (const field of dobFields) {
      if (member[field] && typeof member[field] === 'string' && member[field].trim()) {
        memberDOB = member[field].trim();
        console.log(`[extractMedicalMembers] Member ${idx + 1} found DOB in field "${field}": ${memberDOB}`);
        break;
      }
    }
    
    // If not found, check all keys for date-like values
    if (!memberDOB) {
      for (const [key, value] of Object.entries(member)) {
        if (typeof value === 'string' && value.trim()) {
          const lowerKey = key.toLowerCase();
          // Check if key contains date/birth/dob related terms
          if ((lowerKey.includes('date') || lowerKey.includes('birth') || lowerKey.includes('dob')) &&
              // Check if value looks like a date (YYYY-MM-DD or similar)
              (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value) || /^\d{4}\/\d{2}\/\d{2}/.test(value))) {
            memberDOB = value.trim();
            console.log(`[extractMedicalMembers] Member ${idx + 1} found DOB in field "${key}": ${memberDOB}`);
            break;
          }
        }
      }
    }
    
    // Log all member fields for debugging if DOB not found
    if (!memberDOB) {
      console.log(`[extractMedicalMembers] Member ${idx + 1} DOB not found. Available fields:`, Object.keys(member));
      console.log(`[extractMedicalMembers] Member ${idx + 1} full data:`, JSON.stringify(member, null, 2));
    }
    
    // Always calculate age from DOB if available (more accurate than stored age)
    let age = null;
    
    if (memberDOB) {
      age = calculateAge(memberDOB);
      console.log(`[extractMedicalMembers] Member ${idx + 1} DOB: ${memberDOB}, Calculated age: ${age}`);
    }
    
    // Fallback to stored age or default
    if (age === null) {
      age = member.age || 25;
      console.log(`[extractMedicalMembers] Using stored/default age for member ${idx + 1}: ${age}`);
    }
    
    // Extract gender
    const gender = (member.gender || 'male').toLowerCase();
    
    items.push({
      itemId: `member-${idx + 1}`,
      itemType: 'person',
      itemName: memberName,
      itemDetails: {
        age,
        gender,
        dateOfBirth: memberDOB,
        relationship: member.relationship
      },
      isPrimary: false,
      annualPremium: 0,
      monthlyPremium: 0
    });
  });
  
  return items;
}

/**
 * Extract motor insurance vehicles (placeholder for future)
 */
function extractMotorVehicles(leadData: any): PremiumItem[] {
  const items: PremiumItem[] = [];
  
  // Primary vehicle
  items.push({
    itemId: 'primary-vehicle',
    itemType: 'vehicle',
    itemName: `${leadData.make || ''} ${leadData.model || ''}`.trim() || 'Primary Vehicle',
    itemDetails: {
      make: leadData.make,
      model: leadData.model,
      year: leadData.year,
      value: leadData.vehicleValue
    },
    isPrimary: true,
    annualPremium: 0,
    monthlyPremium: 0
  });
  
  // Additional vehicles (if any)
  const vehicles = leadData.vehicles || [];
  vehicles.forEach((vehicle: any, idx: number) => {
    items.push({
      itemId: `vehicle-${idx + 1}`,
      itemType: 'vehicle',
      itemName: `${vehicle.make} ${vehicle.model}`,
      itemDetails: vehicle,
      isPrimary: false,
      annualPremium: 0,
      monthlyPremium: 0
    });
  });
  
  return items;
}

/**
 * Extract single item for general/marine insurance
 */
function extractSingleItem(leadData: any): PremiumItem[] {
  return [{
    itemId: 'primary',
    itemType: 'single',
    itemName: 'Coverage',
    itemDetails: leadData,
    isPrimary: true,
    annualPremium: 0,
    monthlyPremium: 0
  }];
}

/**
 * Calculate premium for an individual item based on LOB
 */
function calculatePremiumForItem(
  basePremium: number,
  item: PremiumItem,
  lineOfBusiness: LineOfBusiness
): number {
  switch (lineOfBusiness) {
    case 'medical':
      return calculateMedicalPremium(basePremium, item);
    case 'motor':
      return calculateMotorPremium(basePremium, item);
    case 'marine':
    case 'general':
    default:
      return basePremium; // Single premium
  }
}

/**
 * Calculate medical insurance premium based on age and gender
 */
function calculateMedicalPremium(basePremium: number, item: PremiumItem): number {
  const age = item.itemDetails.age;
  const gender = item.itemDetails.gender;
  
  let multiplier = 1.0;
  
  // Age-based multiplier
  if (age < 18) {
    multiplier = 0.35;        // Children: 35%
  } else if (age <= 35) {
    multiplier = 1.0;         // Young adults: 100%
  } else if (age <= 50) {
    multiplier = 1.3;         // Middle age: 130%
  } else if (age <= 65) {
    multiplier = 1.8;         // Seniors: 180%
  } else {
    multiplier = 2.5;         // Elderly: 250%
  }
  
  // Gender adjustment (optional, some plans have this)
  if (gender === 'female' && age >= 19 && age <= 45) {
    multiplier *= 0.95; // 5% adjustment for women of childbearing age
  }
  
  return Math.round(basePremium * multiplier);
}

/**
 * Calculate motor insurance premium (placeholder for future)
 */
function calculateMotorPremium(basePremium: number, item: PremiumItem): number {
  // For now, return base premium
  // Later: calculate based on vehicle value, age, make, etc.
  return basePremium;
}

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

  // Extract premium items (members, vehicles, etc.) based on LOB
  const premiumItems = extractPremiumItems(leadData, lineOfBusiness);
  
  // Transform to Plan model with calculated member-wise premiums
  return basePlans.map((plan, index) => {
    
    // Calculate premium for each item
    const itemsWithPremiums = premiumItems.map(item => {
      const premium = calculatePremiumForItem(
        plan.annualPremium, // Base premium per adult/vehicle/item
        item,
        lineOfBusiness
      );
      
      return {
        ...item,
        annualPremium: premium,
        monthlyPremium: Math.round(premium / 12)
      };
    });
    
    // Sum total premium from all items
    const totalAnnual = itemsWithPremiums.reduce((sum, item) => sum + item.annualPremium, 0);
    const totalMonthly = itemsWithPremiums.reduce((sum, item) => sum + item.monthlyPremium, 0);
    
    return {
      ...plan,
      id: `plan-${leadId}-${index + 1}`,
      leadId,
      fetchRequestId: '', // Will be set by caller
      fetchedAt: new Date(),
      annualPremium: totalAnnual,      // Total for all items
      monthlyPremium: totalMonthly,
      lobSpecificData: {
        ...plan.lobSpecificData,
        itemCount: premiumItems.length,
        premiumItems: itemsWithPremiums,  // Store breakdown
        basePremiumPerItem: plan.annualPremium // Store original base premium
      }
    } as Plan;
  });
}

/**
 * Get vendors by LOB
 */
export function getVendorsByLOB(lineOfBusiness: LineOfBusiness): Omit<Vendor, 'createdAt' | 'updatedAt'>[] {
  return STATIC_VENDORS.filter(v => v.lineOfBusiness === lineOfBusiness);
}

