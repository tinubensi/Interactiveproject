"""
Sukoon DXB Plans Static Benefits Data

This module contains comprehensive benefits information for 6 DXB insurance plans.
This data is used to enrich plans fetched from the Sukoon portal with detailed benefit information.

Data extracted from: test.insurancePlans.json
Plans included: HomeLite DXB, Home DXB, Prime DXB, Pro DXB, Safe DXB, Max DXB
"""

from typing import Dict, Any, Optional


# Static benefits data for all 6 DXB plans
SUKOON_DXB_BENEFITS: Dict[str, Dict[str, Any]] = {
    'homelite': {
        'planName': 'Sukoon Insurance - HomeLite DXB',
        'amount': 250000,
        'outPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered up to 10 sessions with 10% co pay subject to pre-authorization',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
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
                'insideUAEOutsideNetwork': 'Not Covered including treatment Abroad (Maternity Treatment Strictly within Network)',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all outpatient maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'Covered up to annual limit as per DHA Antenatal Protocol (FBC and Platelets, Blood group, Rhesus status and antibodies , VDRL, MSU & urinalysis, Rubella serology, HIV, Hepatitis C offered to high risk patients, GTT if high risk, FBS, Random blood sugar OR HbA1C and Ultrasonography scans)',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sublimit applicable for Pre exisiting conditions with 10% co pay',
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
                'preexistingOutsideUAE': 'Covered subject to the above conditions for Pre-exisitng conditions',
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
                'outsideNetwork': 'Covered on reimbursement basis as per UAE Network Tariff Rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'UAE, Arab Countries, South East Asia'
        },
        'copayForTest': {
            'name': '10% Copay '
        },
        'copayForConsultation': {
            'name': '10% co insurance  '
        },
        'dental': False,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'IH Advance'
        },
        'outpatientnetworkProvider': {
            'networkName': 'IH Advance'
        }
    },
    'home': {
        'planName': 'Sukoon Insurance - Home DXB',
        'amount': 250000,
        'outPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered up to 10 sessions with 10% co pay subject to pre-authorization',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 10,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
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
                'insideUAEOutsideNetwork': 'Not Covered including treatment Abroad (Maternity Treatment Strictly within Network)',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all outpatient maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'Covered up to annual limit as per DHA Antenatal Protocol (FBC and Platelets, Blood group, Rhesus status and antibodies , VDRL, MSU & urinalysis, Rubella serology, HIV, Hepatitis C offered to high risk patients, GTT if high risk, FBS, Random blood sugar OR HbA1C and Ultrasonography scans)',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sublimit applicable for Pre exisiting conditions with 10% co pay',
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
                'preexistingOutsideUAE': 'Covered subject to the above conditions for Pre-exisitng conditions',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 1000 with 20% co insurance subject to prior authorization request',
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
                'outsideNetwork': 'Covered on reimbursement basis as per UAE Network Tariff Rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'UAE, Arab Countries, South East Asia'
        },
        'copayForTest': {
            'name': '10% Copay '
        },
        'copayForConsultation': {
            'name': '10% co insurance  '
        },
        'dental': True,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'IH Signature '
        },
        'outpatientnetworkProvider': {
            'networkName': 'IH Signature '
        }
    },
    'prime': {
        'planName': 'Sukoon Insurance - Prime DXB',
        'amount': 5000000,
        'outPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered up to 10 sessions with 10% co pay subject to pre-authorization',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 25,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Not Covered including treatment Abroad (Maternity Treatment Strictly within Network)',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all outpatient maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'Covered up to annual limit as per DHA Antenatal Protocol (FBC and Platelets, Blood group, Rhesus status and antibodies , VDRL, MSU & urinalysis, Rubella serology, HIV, Hepatitis C offered to high risk patients, GTT if high risk, FBS, Random blood sugar OR HbA1C and Ultrasonography scans)',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sublimit applicable for Pre exisiting conditions with 10% co pay',
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
                'preexistingOutsideUAE': 'Covered subject to the above conditions for Pre-exisitng conditions',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 4000 with 20% co insurance subject to prior authorization request',
                'heading': 'Dental'
            },
            {
                'optical': 'Covered up to AED 1500 on reimbursement basis with 20% co insurance subject to prior authorization request',
                'heading': 'Optical'
            },
            {
                'alternative': 'Covered up to AED 5000 on reimbursement basis',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement basis as per UAE Network Tariff Rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'Worldwide excluding USA and Canada',
            'geographicalScope': 'Worldwide Excluding USA'
        },
        'copayForTest': {
            'name': '10% Copay '
        },
        'copayForConsultation': {
            'name': '10% co insurance  '
        },
        'dental': True,
        'wellness': True,
        'optical': True,
        'inpatientnetworkProvider': {
            'networkName': 'IH Premium'
        },
        'outpatientnetworkProvider': {
            'networkName': 'IH Premium'
        }
    },
    'pro': {
        'planName': 'Sukoon Insurance - Pro DXB',
        'amount': 3000000,
        'outPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered up to 10 sessions with 10% co pay subject to pre-authorization',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 20,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Not Covered including treatment Abroad (Maternity Treatment Strictly within Network)',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all outpatient maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'Covered up to annual limit as per DHA Antenatal Protocol (FBC and Platelets, Blood group, Rhesus status and antibodies , VDRL, MSU & urinalysis, Rubella serology, HIV, Hepatitis C offered to high risk patients, GTT if high risk, FBS, Random blood sugar OR HbA1C and Ultrasonography scans)',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sublimit applicable for Pre exisiting conditions with 10% co pay',
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
                'preexistingOutsideUAE': 'Covered subject to the above conditions for Pre-exisitng conditions',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 2000 with 20% co insurance subject to prior authorization request',
                'heading': 'Dental'
            },
            {
                'optical': 'No Benefit',
                'heading': 'Optical'
            },
            {
                'alternative': 'Covered up to AED 3000 on reimbursement basis',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement basis as per UAE Network Tariff Rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'Worldwide excluding USA and Canada',
            'geographicalScope': 'Worldwide Excluding USA'
        },
        'copayForTest': {
            'name': '10% Copay '
        },
        'copayForConsultation': {
            'name': '10% co insurance  '
        },
        'dental': True,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'IH Edge'
        },
        'outpatientnetworkProvider': {
            'networkName': 'IH Edge'
        }
    },
    'safe': {
        'planName': 'Sukoon Insurance - Safe DXB',
        'amount': 150000,
        'outPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered up to 10 sessions with 10% co pay subject to pre-authorization',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered with 20% coinsurance payable by the insured with a cap of 500 AED payable per encounter and an annual aggregate cap of 1000 AED.\nAbove these caps the insurer will cover 100% of treatment.',
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
                'insideUAEOutsideNetwork': 'Not Covered including treatment Abroad (Maternity Treatment Strictly within Network)',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all outpatient maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'Covered up to annual limit as per DHA Antenatal Protocol (FBC and Platelets, Blood group, Rhesus status and antibodies , VDRL, MSU & urinalysis, Rubella serology, HIV, Hepatitis C offered to high risk patients, GTT if high risk, FBS, Random blood sugar OR HbA1C and Ultrasonography scans)',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sublimit applicable for Pre exisiting conditions with 10% co pay',
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
                'preexistingOutsideUAE': 'Covered subject to the above conditions for Pre-exisitng conditions',
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
                'outsideNetwork': 'Covered on reimbursement basis as per UAE Network Tariff Rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'UAE and Regional',
            'geographicalScope': 'UAE, Arab Countries, South East Asia'
        },
        'copayForTest': {
            'name': '10% Copay '
        },
        'copayForConsultation': {
            'name': '10% co insurance  '
        },
        'dental': False,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'IH Safe'
        },
        'outpatientnetworkProvider': {
            'networkName': 'IH Safe'
        }
    },
    'max': {
        'planName': 'Sukoon Insurance - Max DXB',
        'amount': 500000,
        'outPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Pharmacy': 'Covered up to annual limit with 10% co insurance subject to pre authorization',
                'heading': 'Pharmacy for non-pre-existing conditions'
            },
            {
                'physiotherapy': 'Covered up to 10 sessions with 10% co pay subject to pre-authorization',
                'heading': 'Physiotherapy'
            }
        ],
        'inPatient': [
            {
                'testAndTreatment': 'Covered up to annual limit subject to pre authorization',
                'heading': 'Tests and Treatments for non-pre-existing conditions'
            },
            {
                'Room and Board': 'Private Room',
                'heading': 'Room and Board'
            }
        ],
        'maternity': [
            {
                'normalDelivery': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Normal Delivery'
            },
            {
                'cesarian': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Cesarian Section'
            },
            {
                'mismarriage': 'Covered up to a of AED 15,000/- for inpatient treatment in aggregate to all inpatient maternity treatment',
                'heading': 'Miscarriage/Legal abortion'
            },
            {
                'insideUAEOutsideNetwork': 'Not Covered including treatment Abroad (Maternity Treatment Strictly within Network)',
                'heading': 'Inside UAE outside the network'
            },
            {
                'co-insurance': '10% co insurance on all outpatient maternity services',
                'heading': 'Co Insurance'
            },
            {
                'waitingPeriod': 'NIL',
                'heading': 'Waiting Period'
            },
            {
                'outPatientservice': 'Covered up to annual limit as per DHA Antenatal Protocol (FBC and Platelets, Blood group, Rhesus status and antibodies , VDRL, MSU & urinalysis, Rubella serology, HIV, Hepatitis C offered to high risk patients, GTT if high risk, FBS, Random blood sugar OR HbA1C and Ultrasonography scans)',
                'heading': 'Outpatient Services'
            }
        ],
        'preExistingMedicalCondition': [
            {
                'subLimitInpatientOutpatient': 'Covered up to a sub limit of AED 150,000',
                'heading': 'Sub Limit for Outpatient & Inpatient Treatment inside UAE'
            },
            {
                'outpatientPharmacy': 'Covered up to sublimit applicable for Pre exisiting conditions with 10% co pay',
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
                'preexistingOutsideUAE': 'Covered subject to the above conditions for Pre-exisitng conditions',
                'heading': 'Pre-existing conditions outside UAE'
            }
        ],
        'otherBenefits': [
            {
                'dental': 'Covered up to AED 1000 with 20% co insurance subject to prior authorization request',
                'heading': 'Dental'
            },
            {
                'optical': 'No Benefit',
                'heading': 'Optical'
            },
            {
                'alternative': 'Covered up to AED 3000 on reimbursement basis',
                'heading': 'Alternatives Medicines'
            }
        ],
        'basisClaim': [
            {
                'withinNetwork': 'Covered subject to pre-authorization',
                'heading': 'Within Network'
            },
            {
                'outsideNetwork': 'Covered on reimbursement basis as per UAE Network Tariff Rates',
                'heading': 'Outside network within Geographical Scope'
            }
        ],
        'area': {
            'name': 'Worldwide excluding USA and Canada',
            'geographicalScope': 'Worldwide Excluding USA'
        },
        'copayForTest': {
            'name': '10% Copay '
        },
        'copayForConsultation': {
            'name': '10% co insurance  '
        },
        'dental': True,
        'wellness': True,
        'optical': False,
        'inpatientnetworkProvider': {
            'networkName': 'IH Signature plus medcare'
        },
        'outpatientnetworkProvider': {
            'networkName': 'IH Signature plus medcare'
        }
    }
}


def normalize_plan_name(plan_name: str) -> Optional[str]:
    """
    Normalize plan name for matching against DXB benefits.
    
    Extracts the base plan name and normalizes it to lowercase without spaces.
    
    Examples:
        "Sukoon HealthPlus - PRIME" -> "prime"
        "Sukoon HealthPlus - HOME LITE" -> "homelite"
        "Sukoon Insurance - Pro DXB" -> "pro"
    
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
    prefixes = ['sukoon healthplus - ', 'sukoon insurance - ', 'sukoon - ']
    for prefix in prefixes:
        if plan_name_lower.startswith(prefix):
            plan_name = plan_name[len(prefix):]
            break
    
    # Remove DXB suffix if present
    if plan_name.lower().endswith(' dxb'):
        plan_name = plan_name[:-4]
    
    # Normalize: lowercase and remove spaces
    normalized = plan_name.lower().replace(' ', '').strip()
    
    return normalized if normalized else None


def get_benefits_for_plan(plan_name: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve benefits data for a given plan name.
    
    Args:
        plan_name: The plan name to look up (e.g., "Sukoon HealthPlus - PRIME")
        
    Returns:
        Dictionary containing benefit data or None if plan not found
    """
    normalized = normalize_plan_name(plan_name)
    
    if normalized and normalized in SUKOON_DXB_BENEFITS:
        return SUKOON_DXB_BENEFITS[normalized].copy()
    
    return None


def get_all_plan_names() -> list:
    """
    Get list of all plan names that have benefits data.
    
    Returns:
        List of normalized plan names
    """
    return list(SUKOON_DXB_BENEFITS.keys())
