"""
GIG Gulf Field Mappings
Maps vendor-specific field names to standard field names used across the system
"""
from typing import Dict, List

# Coverage Details Field Mappings: GIG Gulf field names -> Standard field names
COVERAGE_FIELD_MAPPINGS: Dict[str, str] = {
    "yearlyMaximum": "Annual Limit",
    "areaOfCover": "Geographical Coverage",
    "outsideAreaOfCover": "Outside Coverage Area",
    "complementaryTherapy": "Complementary Therapy",
    "homeopathyAyurvedicTreatment": "Alternative Medicine",
    "perVisitDeductible": "Per Visit Deductible",
    "inpatientDirectBillingNetwork": "Inpatient Network",
    "outpatientDirectBillingNetwork": "Outpatient Network",
    "healthScreen": "Health Screening",
    "preexistingConditionsWithinUAE": "Pre-existing Conditions (UAE)",
    "preexistingConditionsOutsideUAE": "Pre-existing Conditions (Outside UAE)",
    "optical": "Optical Coverage",
    "psychiatricTreatment": "Psychiatric Treatment",
    "maternityOutpatient": "Maternity Outpatient",
    "normalPregnancyChildbirth": "Maternity Coverage",
    "routineDentalCare": "Dental Coverage",
    "ancillaryEquipment": "Medical Equipment",
    "personalAccident": "Personal Accident",
    "teleConsultation": "Teleconsultation",
}

# Benefit Category Keywords: Maps field names to benefit categories
BENEFIT_CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "outpatient": [
        "perVisitDeductible",
        "outpatientDirectBillingNetwork",
        "teleConsultation",
    ],
    "inpatient": [
        "inpatientDirectBillingNetwork",
    ],
    "maternity": [
        "maternityOutpatient",
        "normalPregnancyChildbirth",
    ],
    "dental": [
        "routineDentalCare",
    ],
    "optical": [
        "optical",
    ],
    "alternative": [
        "complementaryTherapy",
        "homeopathyAyurvedicTreatment",
    ],
    "emergency": [
        "personalAccident",
    ],
    "diagnostics": [
        "healthScreen",
    ],
    "other-coverage": [
        "areaOfCover",
        "yearlyMaximum",
        "outsideAreaOfCover",
        "preexistingConditionsWithinUAE",
        "preexistingConditionsOutsideUAE",
        "ancillaryEquipment",
        "psychiatricTreatment",
    ],
}

# Friendly category names for display
CATEGORY_NAMES: Dict[str, str] = {
    "outpatient": "Outpatient Benefits",
    "inpatient": "Inpatient Benefits",
    "maternity": "Maternity Benefits",
    "dental": "Dental Coverage",
    "optical": "Optical Coverage",
    "alternative": "Alternative Medicine",
    "emergency": "Emergency Services",
    "diagnostics": "Diagnostic Services",
    "other-coverage": "Other Coverage Details",
}

# Reverse mapping: Standard field names -> GIG Gulf field names (for reference)
REVERSE_FIELD_MAPPINGS: Dict[str, str] = {v: k for k, v in COVERAGE_FIELD_MAPPINGS.items()}
