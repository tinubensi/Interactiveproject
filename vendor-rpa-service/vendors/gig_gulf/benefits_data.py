"""
GIG Gulf Plans Static Benefits Data

This module contains comprehensive benefits information for 5 GIG insurance plans.
This data is used to enrich plans fetched from the GIG Gulf portal with detailed benefit information.

Data extracted from: test.insurancePlans-GIG.json
Plans included: Gold, Silver, Global, Bronze, Regional
"""

from typing import Dict, Any, Optional


# Static benefits data for all 5 GIG plans
GIG_BENEFITS: Dict[str, Dict[str, Any]] = {
    'gold': {
        'planName': 'GIG - Gold',
        'amount': 500000,
        'outPatient': [
            {
                'testAndTreatment': '10% co insurance',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered subject to pre authorization with 10% co insurance',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'All Outpatient services provided in relation to maternity would be covered from the policy limit subject to pre authorization',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sub limit subject to pre authorization with 10% co insurance',
                'heading': 'Outpatient Pharmacy'
            },
            {
                'waitingPeriod': 'Pre Existing conditions are covered from the enrolment date of first scheme membership, subject to declaration at inception and individual medical underwriting',
                'heading': 'Waiting Period'
            },
            {
                'note': 'Undeclared preexisting conditions will not be covered during the policy period and will be underwritten at renewal',
                'heading': 'Note'
            },
            {
                'preexistingOutsideUAE': 'Covered up to AED 2500 with 10% co insurance on outpatient services',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 1000 with 20% co insurance & 9 months waiting period (Dental Consultation, Tooth Extraction, Amalgam & Composite filling, Root Canal Treatment (R.C.T), Scaling, Bridgework, Crown at a grade appropriate to restore function only, treatment of gum disease)',
                'heading': 'Dental'
            },
            {
                'optical': 'No Benefit',
                'heading': 'Optical'
            },
            {
                'alternative': 'Covered up to AED 3000 on reimbursement basis (Includes courses of chiropractic treatment and osteopathy/alternative treatment)',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement as per applicable UAE tariff rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'UAE plus any one of India, Pakistan, Sri Lanka, Bangladesh, the Philippines, Nepal & Bhutan being your home country'
        },
        'copayForTest': {
            'name': '10% Copay'
        },
        'copayForConsultation': {
            'name': '10% Copay'
        },
        'dental': True,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'GIG - IH 3 for IP IH 4 for OP'
        },
        'outpatientnetworkProvider': {
            'networkName': 'GIG - IH 3 for IP IH 4 for OP'
        }
    },
    'silver': {
        'planName': 'GIG - Silver',
        'amount': 250000,
        'outPatient': [
            {
                'testAndTreatment': '10% co insurance',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered subject to pre authorization with 10% co insurance',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'All Outpatient services provided in relation to maternity would be covered from the policy limit subject to pre authorization',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sub limit subject to pre authorization with 10% co insurance',
                'heading': 'Outpatient Pharmacy'
            },
            {
                'waitingPeriod': 'Pre Existing conditions are covered from the enrolment date of first scheme membership, subject to declaration at inception and individual medical underwriting',
                'heading': 'Waiting Period'
            },
            {
                'note': 'Undeclared preexisting conditions will not be covered during the policy period and will be underwritten at renewal',
                'heading': 'Note'
            },
            {
                'preexistingOutsideUAE': 'Covered up to AED 1500 with 10% co insurance on outpatient services',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'No Benefit',
                'heading': 'Dental'
            },
            {
                'optical': 'No Benefit',
                'heading': 'Optical'
            },
            {
                'alternative': 'No Benefit',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement as per applicable UAE tariff rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'UAE plus any one of India, Pakistan, Sri Lanka, Bangladesh, the Philippines, Nepal & Bhutan being your home country'
        },
        'copayForTest': {
            'name': '10% Copay'
        },
        'copayForConsultation': {
            'name': '10% Copay'
        },
        'dental': False,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'GIG  - IH 4 for IP IH 5 for OP'
        },
        'outpatientnetworkProvider': {
            'networkName': 'GIG  - IH 4 for IP IH 5 for OP'
        }
    },
    'global': {
        'planName': 'GIG - Global',
        'amount': 7500000,
        'outPatient': [
            {
                'testAndTreatment': '10% co insurance',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered subject to pre authorization with 10% co insurance',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'All Outpatient services provided in relation to maternity would be covered from the policy limit subject to pre authorization',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to annual limit subject to pre authorization and applicable co insurance',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to annual limit subject to pre authorization with 10% co insurance',
                'heading': 'Outpatient Pharmacy'
            },
            {
                'waitingPeriod': 'Pre Existing conditions are covered from the enrolment date of first scheme membership, subject to declaration at inception and individual medical underwriting',
                'heading': 'Waiting Period'
            },
            {
                'note': 'Undeclared preexisting conditions will not be covered during the policy period and will be underwritten at renewal',
                'heading': 'Note'
            },
            {
                'preexistingOutsideUAE': 'Covered up to AED 5000 with 10% co insurance on outpatient services',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 4000 with 20% co insurance & 9 months waiting period (Dental Consultation, Tooth Extraction, Amalgam & Composite filling, Root Canal Treatment (R.C.T), Scaling, Bridgework, Crown at a grade appropriate to restore function only, treatment of gum disease)',
                'heading': 'Dental'
            },
            {
                'optical': 'Covered up to AED 1500 with 20% co insurance (This includes routine optical services carried out by a qualified and registered opthalmologist or optometrist; and costs of prescribed spectacles and corrective lenses for refractive errors)',
                'heading': 'Optical'
            },
            {
                'alternative': 'Covered up to AED 5000 on reimbursement basis (Includes courses of chiropractic treatment and osteopathy/alternative treatment)',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement as per applicable UAE tariff rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'Worldwide excluding USA and Canada',
            'geographicalScope': 'Worldwide Excluding USA'
        },
        'copayForTest': {
            'name': '10% Copay'
        },
        'copayForConsultation': {
            'name': '10% Copay'
        },
        'dental': True,
        'wellness': True,
        'optical': True,
        'inpatientnetworkProvider': {
            'networkName': 'GIG - IH 1'
        },
        'outpatientnetworkProvider': {
            'networkName': 'GIG - IH 1'
        }
    },
    'bronze': {
        'planName': 'GIG - Bronze',
        'amount': 150000,
        'outPatient': [
            {
                'testAndTreatment': '10% co insurance',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered subject to pre authorization with 10% co insurance',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 7,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Covered up to a of AED 7,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'All Outpatient services provided in relation to maternity would be covered from the policy limit subject to pre authorization',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to AED 1500 with 10% co insurance',
                'heading': 'Outpatient Pharmacy'
            },
            {
                'waitingPeriod': 'Pre Existing conditions are covered from the enrolment date of first scheme membership, subject to declaration at inception and individual medical underwriting',
                'heading': 'Waiting Period'
            },
            {
                'note': 'Undeclared preexisting conditions will not be covered during the policy period and will be underwritten at renewal',
                'heading': 'Note'
            },
            {
                'preexistingOutsideUAE': 'Not Covered',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'No Benefit',
                'heading': 'Dental'
            },
            {
                'optical': 'No Benefit',
                'heading': 'Optical'
            },
            {
                'alternative': 'No Benefit',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement as per applicable UAE tariff rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'UAE'
        },
        'copayForTest': {
            'name': '10% Copay'
        },
        'copayForConsultation': {
            'name': '10% Copay'
        },
        'dental': False,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'GIG - IH 5 for IP IH 6 for OP'
        },
        'outpatientnetworkProvider': {
            'networkName': 'GIG - IH 5 for IP IH 6 for OP'
        }
    },
    'regional': {
        'planName': 'GIG - Regional',
        'amount': 2500000,
        'outPatient': [
            {
                'testAndTreatment': '10% co insurance',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered subject to pre authorization with 10% co insurance',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient & outpatient maternity treatment',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'All Outpatient services provided in relation to maternity would be covered from the policy limit subject to pre authorization',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to annual limit subject to pre authorization and applicable co insurance',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to annual limit subject to pre authorization with 10% co insurance',
                'heading': 'Outpatient Pharmacy'
            },
            {
                'waitingPeriod': 'Pre Existing conditions are covered from the enrolment date of first scheme membership, subject to declaration at inception and individual medical underwriting',
                'heading': 'Waiting Period'
            },
            {
                'note': 'Undeclared preexisting conditions will not be covered during the policy period and will be underwritten at renewal',
                'heading': 'Note'
            },
            {
                'preexistingOutsideUAE': 'Covered up to AED 2500 with 10% co insurance on outpatient services',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 2000 with 20% co insurance & 9 months waiting period (Dental Consultation, Tooth Extraction, Amalgam & Composite filling, Root Canal Treatment (R.C.T), Scaling, Bridgework, Crown at a grade appropriate to restore function only, treatment of gum disease)',
                'heading': 'Dental'
            },
            {
                'optical': 'No Benefit',
                'heading': 'Optical'
            },
            {
                'alternative': 'Covered up to AED 3000 on reimbursement basis (Includes courses of chiropractic treatment and osteopathy/alternative treatment)',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement as per applicable UAE tariff rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'A.G.C.C: Arabian Gulf Co-operation Council member countries being Saudi Arabia, Kuwait, Bahrain, Qatar, UAE, Oman and Jordan, plus Iran, Lebanon, Syria, Egypt, Tunisia, Morocco, Algeria, India, Pakistan, Sri Lanka, Bangladesh, Korea, the Philippines, Indonesia, Nepal & Bhutan'
        },
        'copayForTest': {
            'name': '10% Copay'
        },
        'copayForConsultation': {
            'name': '10% Copay'
        },
        'dental': True,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'GIG - IH 2'
        },
        'outpatientnetworkProvider': {
            'networkName': 'GIG - IH 2'
        }
    }
}


def normalize_plan_name(plan_name: str) -> Optional[str]:
    """
    Normalize plan name for matching against GIG benefits.
    
    Extracts the base plan name and normalizes it to lowercase without spaces.
    
    Examples:
        "GIG - Gold" -> "gold"
        "GIG - Silver" -> "silver"
        "GIG-Global" -> "global"
        "GIG - Regional" -> "regional"
    
    Args:
        plan_name: The plan name string to normalize
        
    Returns:
        Normalized plan name key or None if invalid
    """
    if not plan_name or not isinstance(plan_name, str):
        return None
    
    # Convert to lowercase first for case-insensitive matching
    plan_name_lower = plan_name.lower()
    
    # Remove common prefixes (case-insensitive)
    prefixes = ['gig - ', 'gig-', 'gig ']
    for prefix in prefixes:
        if plan_name_lower.startswith(prefix):
            plan_name = plan_name[len(prefix):]
            break
    
    # Normalize: lowercase and remove spaces
    normalized = plan_name.lower().replace(' ', '').strip()
    
    return normalized if normalized else None


def get_benefits_for_plan(plan_name: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve benefits data for a given plan name.
    
    Args:
        plan_name: The plan name to look up (e.g., "GIG - Gold")
        
    Returns:
        Dictionary containing benefit data or None if plan not found
    """
    normalized = normalize_plan_name(plan_name)
    
    if normalized and normalized in GIG_BENEFITS:
        return GIG_BENEFITS[normalized].copy()
    
    return None


def get_all_plan_names() -> list:
    """
    Get list of all plan names that have benefits data.
    
    Returns:
        List of normalized plan names
    """
    return list(GIG_BENEFITS.keys())
