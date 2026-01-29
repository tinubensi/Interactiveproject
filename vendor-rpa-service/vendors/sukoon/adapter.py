"""
Sukoon Insurance Adapter
Handles data transformation for Sukoon Insurance portal
"""
from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime
import re
from vendors.base.vendor_adapter import VendorAdapter
from vendors.sukoon.parser import (
    clean_number, parse_coverage, parse_benefit, 
    parse_premium, extract_network_type, extract_aggregate_limit
)

# Metadata fields to exclude from benefits categorization
METADATA_FIELDS = {
    'indicative premium', 'premium', 'price', 'tpa', 'network'
}

# Category keywords for semantic categorization
CATEGORY_KEYWORDS = {
    'outpatient': ['outpatient', 'out-patient', 'consultation', 'gp', 'specialist', 'op ', 'clinic'],
    'inpatient': ['inpatient', 'in-patient', 'hospitalization', 'hospital', 'room', 'surgery', 'icu', 'ccu'],
    'maternity': ['maternity', 'pregnancy', 'delivery', 'natal', 'newborn', 'c-section', 'caesarean', 'cesarean'],
    'dental': ['dental', 'teeth', 'orthodontic'],
    'optical': ['optical', 'vision', 'eye', 'glasses', 'contact lens', 'frames'],
    'pharmacy': ['pharmacy', 'medication', 'medicine', 'drug'],
    'emergency': ['emergency', 'ambulance'],
    'diagnostics': ['diagnostic', 'lab', 'laboratory', 'test', 'scan', 'x-ray', 'mri'],
    'physiotherapy': ['physiotherapy', 'physio', 'rehabilitation'],
    'alternative': ['alternative medicine', 'alternate medicine', 'homeopathy', 'acupuncture']
}

# Friendly category names
CATEGORY_NAMES = {
    'outpatient': 'Outpatient Benefits',
    'inpatient': 'Inpatient Benefits',
    'maternity': 'Maternity Benefits',
    'dental': 'Dental Coverage',
    'optical': 'Optical Coverage',
    'pharmacy': 'Pharmacy Coverage',
    'emergency': 'Emergency Services',
    'diagnostics': 'Diagnostic Services',
    'physiotherapy': 'Physiotherapy',
    'alternative': 'Alternative Medicine',
    'other-coverage': 'Other Coverage Details'
}


class SukoonAdapter(VendorAdapter):
    """
    Adapter for Sukoon Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to Sukoon-specific payload
    2. Transform Sukoon response to StandardPlan (UNIFIED STRUCTURE V2)
    """
    
    def __init__(self):
        super().__init__(vendor_id="vendor-sukoon", vendor_name="Sukoon Insurance")
    
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into Sukoon-specific payload format for form filling.
        
        Supports both individual and family coverage by extracting primary member
        and all dependents from lead data.
        
        Sukoon expects specific form field values as defined in the browser script.
        """
        # Extract lobData (medical-specific fields)
        lob_data = standard_lead.get('lobData', {})
        
        # Extract lead ID
        lead_id = standard_lead.get('leadId') or standard_lead.get('id', 'unknown')
        
        # Visa Type mapping for Sukoon dropdown (applies to all members)
        visa_type_raw = lob_data.get('visaType') or standard_lead.get('visaType', 'citizen')
        visa_type_mapping = {
            'resident': '1',
            'citizen': '5',      # UAE/GCC National
            'gcc_national': '5',
            'dependent': '2',
            'visit_visa': '3'
        }
        visa_type = visa_type_mapping.get(visa_type_raw.lower() if isinstance(visa_type_raw, str) else 'citizen', '5')
        
        # Initialize members array
        members = []
        
        # ============ PRIMARY MEMBER (Index 0) ============
        primary_member = self._extract_member_data(
            dob=lob_data.get('dateOfBirth') or standard_lead.get('dob', '1996-06-15'),
            gender=lob_data.get('gender') or standard_lead.get('gender', 'Male'),
            marital_status=lob_data.get('maritalStatus') or standard_lead.get('maritalStatus', 'Single'),
            nationality=lob_data.get('nationality') or standard_lead.get('nationality', 'UAE'),
            relationship='Self/Employee',
            index=0,
            is_primary=True
        )
        members.append(primary_member)
        
        # ============ DEPENDENTS (Index 1+) ============
        dependents = lob_data.get('dependents', [])
        if isinstance(dependents, list):
            for idx, dependent in enumerate(dependents):
                # Extract dependent info
                dep_dob = dependent.get('dateOfBirth', '2000-01-01')
                dep_gender = dependent.get('gender', 'Male')
                dep_relationship = dependent.get('relationship', 'Child')
                dep_nationality = dependent.get('nationality') or lob_data.get('nationality', 'UAE')
                
                # Determine marital status based on relationship
                # Children are always Single, others inherit or default
                if dep_relationship.lower() == 'child':
                    dep_marital = 'Single'
                elif dep_relationship.lower() == 'spouse':
                    dep_marital = 'Married'
                else:
                    # For parents or other relationships, use primary's status or default
                    dep_marital = dependent.get('maritalStatus', 'Married')
                
                dependent_member = self._extract_member_data(
                    dob=dep_dob,
                    gender=dep_gender,
                    marital_status=dep_marital,
                    nationality=dep_nationality,
                    relationship=dep_relationship,
                    index=idx + 1,
                    is_primary=False
                )
                members.append(dependent_member)
        
        # Build Sukoon-specific payload with members array
        return {
            'leadId': lead_id,
            'visaType': visa_type,
            'members': members
        }
    
    def _extract_member_data(self, dob: str, gender: str, marital_status: str, 
                            nationality: str, relationship: str, index: int, 
                            is_primary: bool = False) -> Dict[str, Any]:
        """
        Helper method to extract and normalize member data.
        
        Args:
            dob: Date of birth (ISO format)
            gender: Gender (Male/Female)
            marital_status: Marital status
            nationality: Nationality name
            relationship: Relationship to primary (Self/Employee, Spouse, Child, Parent)
            index: Member index for form filling
            is_primary: Whether this is the primary insured
            
        Returns:
            Dictionary with normalized member data for Sukoon portal
        """
        # Gender mapping
        gender_normalized = gender.lower() if isinstance(gender, str) else 'male'
        
        # Marital status mapping for Sukoon dropdown
        marital_mapping = {
            'single': '1',
            'married': '2',
            'divorced': '3',
            'widowed': '4'
        }
        marital_code = marital_mapping.get(
            marital_status.lower() if isinstance(marital_status, str) else 'single', 
            '1'
        )
        
        # Nationality mapping to GUID
        nationality_guid_mapping = {
            'uae': 'a275c17e-afe4-e611-80c9-005056bd7a8d',
            'united arab emirates': 'a275c17e-afe4-e611-80c9-005056bd7a8d',
            'india': 'a375c17e-afe4-e611-80c9-005056bd7a8d',  # Example - adjust as needed
            'pakistan': 'a475c17e-afe4-e611-80c9-005056bd7a8d',  # Example - adjust as needed
            # Add more nationalities as needed by inspecting portal dropdown
        }
        nationality_guid = nationality_guid_mapping.get(
            nationality.lower() if isinstance(nationality, str) else 'uae',
            'a275c17e-afe4-e611-80c9-005056bd7a8d'  # Default to UAE
        )
        
        return {
            'index': index,
            'relationship': relationship,
            'gender': gender_normalized,
            'dob': dob,
            'maritalStatus': marital_code,
            'nationality': nationality_guid,
            'isPrimary': is_primary
        }
    
    def _extract_limit_from_details(self, coverage_details: Dict[str, Any], keywords: List[str]) -> Optional[float]:
        """
        Extract sub-limit from coverage details based on keywords.
        
        Args:
            coverage_details: Plan details dictionary
            keywords: List of keywords to search for
            
        Returns:
            Float limit value or None if not found
        """
        for key, value in coverage_details.items():
            key_lower = key.lower()
            # Check if any keyword matches the key
            # Use exact matching to avoid false positives
            matched = False
            for kw in keywords:
                if kw in key_lower:
                    # Extra check for pharmacy: exclude alternative medicine
                    if 'pharmacy' in keywords and ('alternative' in key_lower or 'alternate' in key_lower):
                        continue
                    matched = True
                    break
            
            if not matched:
                continue
            
            # Try to extract number from value
            if isinstance(value, (int, float)):
                return float(value)
            
            value_str = str(value)
            # Try to parse using existing parser
            parsed = parse_benefit(value_str)
            if isinstance(parsed, (int, float)) and parsed > 0:
                return float(parsed)
            
            # Try AED pattern
            match = re.search(r'AED\s*([\d,]+)', value_str)
            if match:
                try:
                    return float(match.group(1).replace(',', ''))
                except:
                    pass
            
            # Try plain numbers
            match = re.search(r'(\d+[,\d]*)', value_str)
            if match:
                try:
                    return float(match.group(1).replace(',', ''))
                except:
                    pass
        
        return None
    
    def _extract_copays(self, coverage_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and structure copay information.
        
        Args:
            coverage_details: Plan details dictionary
            
        Returns:
            Structured copay dictionary
        """
        copays = {}
        
        # Look for co-pay related keys
        for key, value in coverage_details.items():
            key_lower = key.lower()
            
            if 'co-pay' in key_lower or 'copay' in key_lower:
                value_str = str(value)
                
                # Extract percentage
                percent_match = re.search(r'(\d+)%', value_str)
                if percent_match:
                    copays['general'] = f"{percent_match.group(1)}%"
                
                # Extract max amount
                max_match = re.search(r'max AED\s*(\d+)', value_str)
                if max_match:
                    copays['maxAmount'] = int(max_match.group(1))
                
                # Store full description
                copays['description'] = value_str
        
        return copays
    
    def _extract_network_info(self, raw_plan: Dict[str, Any]) -> Tuple[Optional[str], Optional[str], str]:
        """
        Extract TPA and network information from plan data.
        
        Args:
            raw_plan: Raw plan dictionary
            
        Returns:
            Tuple of (tpa, network_name, network_type)
        """
        details = raw_plan.get('details', {})
        
        # Extract TPA
        tpa = details.get('TPA') or details.get('tpa')
        
        # Extract network name
        network_name = details.get('NETWORK') or details.get('Network') or details.get('network')
        if not network_name:
            network_name = extract_network_type(details)
        
        # If no TPA but we have network name, use network name as TPA for Sukoon
        # This ensures Sukoon plans appear in the TPA filter options
        if not tpa and network_name:
            tpa = network_name  # e.g., "Premium", "Edge", "Signature+Medicare"
        
        # Determine network type based on coverage territory
        territory = details.get('Basic Coverage Territory') or details.get('BASIC COVERAGE TERRITORY', '')
        territory_lower = str(territory).lower()
        
        if 'worldwide' in territory_lower or 'international' in territory_lower:
            network_type = 'international'
        elif 'gcc' in territory_lower:
            network_type = 'regional'
        else:
            network_type = 'standard'
        
        return tpa, network_name, network_type
    
    def _categorize_benefits(self, coverage_details: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Categorize benefits semantically based on keywords.
        
        Handles both:
        1. Enriched format with benefit arrays (outPatient, inPatient, maternity, etc.)
        2. Legacy format with flat key-value pairs
        
        Args:
            coverage_details: Plan details dictionary
            
        Returns:
            List of benefit categories with categorized benefits
        """
        # Initialize categories dict
        categorized = {cat_id: [] for cat_id in CATEGORY_KEYWORDS.keys()}
        categorized['other-coverage'] = []
        
        # Check for enriched benefit arrays and process them first
        enriched_sections = {
            'outPatient': 'outpatient',
            'inPatient': 'inpatient',
            'maternity': 'maternity',
            'preExistingMedicalCondition': 'other-coverage',
            'otherBenefits': None,  # Will be distributed by content
            'basisClaim': 'other-coverage'
        }
        
        for section_key, default_category in enriched_sections.items():
            if section_key in coverage_details:
                section_data = coverage_details[section_key]
                if isinstance(section_data, list):
                    # Process array of benefit items
                    for item in section_data:
                        if not isinstance(item, dict):
                            continue
                        
                        # Extract heading and benefit details
                        heading = item.get('heading', '')
                        
                        # For otherBenefits, determine category by content
                        if section_key == 'otherBenefits':
                            # Try to match by heading
                            heading_lower = heading.lower()
                            if 'dental' in heading_lower:
                                target_category = 'dental'
                            elif 'optical' in heading_lower:
                                target_category = 'optical'
                            elif 'alternative' in heading_lower or 'medicine' in heading_lower:
                                target_category = 'alternative'
                            else:
                                target_category = 'other-coverage'
                        else:
                            target_category = default_category
                        
                        # Extract benefit values (skip heading key)
                        for key, value in item.items():
                            if key == 'heading' or not value:
                                continue
                            
                            value_str = str(value).strip()
                            
                            # Determine if covered
                            is_covered = value_str not in ['X', '✘', 'x', 'Not Covered', 'Nil', 'No Benefit']
                            
                            # Create benefit entry
                            benefit_entry = {
                                'name': heading or key,
                                'covered': is_covered,
                                'description': value_str,
                                'limit': value_str
                            }
                            
                            categorized[target_category].append(benefit_entry)
        
        # Process remaining flat key-value pairs (legacy format or additional details)
        for key, value in coverage_details.items():
            # Skip enriched sections (already processed)
            if key in enriched_sections:
                continue
            
            key_lower = key.lower()
            
            # Skip if value is a dict or list (nested structures)
            if isinstance(value, (dict, list)):
                continue
            
            value_str = str(value).strip()
            
            # Skip metadata fields
            if any(meta in key_lower for meta in METADATA_FIELDS):
                continue
            
            # Skip empty values
            if not value_str or value_str in ['N/A', 'X', '✘', 'x', '']:
                continue
            
            # Try to match to a category
            matched_category = None
            for cat_id, keywords in CATEGORY_KEYWORDS.items():
                if any(kw in key_lower for kw in keywords):
                    matched_category = cat_id
                    break
            
            # If no match, put in other-coverage
            if matched_category is None:
                matched_category = 'other-coverage'
            
            # Determine if covered
            is_covered = value_str not in ['X', '✘', 'x', 'Not Covered', 'Nil']
            
            # Create benefit entry
            benefit_entry = {
                'name': key,
                'covered': is_covered,
                'description': value_str,
                'limit': value_str
            }
            
            categorized[matched_category].append(benefit_entry)
        
        # Build final structure - only include non-empty categories
        result = []
        for cat_id, benefits_list in categorized.items():
            if len(benefits_list) > 0:
                result.append({
                    'categoryId': cat_id,
                    'categoryName': CATEGORY_NAMES.get(cat_id, cat_id.replace('-', ' ').title()),
                    'benefits': benefits_list
                })
        
        # If no categories found, return default
        if len(result) == 0:
            result = [{
                'categoryId': 'standard',
                'categoryName': 'Standard Benefits',
                'benefits': [{
                    'name': 'Basic Health Coverage',
                    'covered': True,
                    'description': 'Basic health coverage as per policy terms',
                    'limit': 'As per policy'
                }]
            }]
        
        return result
    
    def _clean_coverage_details(self, details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Remove enriched arrays and objects from coverage details.
        
        The enriched benefit data (arrays and objects) are already processed
        into the structured benefits format. We only want simple key-value pairs
        in coverage_details for display purposes.
        
        Args:
            details: Original details dictionary with enriched data
            
        Returns:
            Cleaned dictionary with only simple values (strings, numbers, booleans)
        """
        # Fields added by benefits enricher that should be removed
        enriched_fields = [
            'outPatient',
            'inPatient',
            'maternity',
            'preExistingMedicalCondition',
            'otherBenefits',
            'basisClaim',
            'area',
            'copayForTest',
            'copayForConsultation',
            'inpatientnetworkProvider',
            'outpatientnetworkProvider'
        ]
        
        cleaned = {}
        
        for key, value in details.items():
            # Skip enriched fields
            if key in enriched_fields:
                continue
            
            # Skip any remaining arrays or objects
            if isinstance(value, (dict, list)):
                continue
            
            # Keep simple types (str, int, float, bool)
            if isinstance(value, (str, int, float, bool)):
                cleaned[key] = value
        
        return cleaned
    
    def normalize_response(self, raw_vendor_data: Any, lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw Sukoon data into StandardPlan format (UNIFIED STRUCTURE V2).
        
        Args:
            raw_vendor_data: List of plan dictionaries from scraper
            lead_id: Lead ID to associate plans with
            
        Returns:
            List of StandardPlan dictionaries
        """
        if not isinstance(raw_vendor_data, list):
            return []
        
        standard_plans = []
        
        for idx, raw_plan in enumerate(raw_vendor_data):
            try:
                plan_name = raw_plan.get('plan_name', f'Sukoon Plan {idx+1}')
                details = raw_plan.get('details', {})
                
                # Extract premium (required field)
                premium_str = raw_plan.get('premium')
                if not premium_str and 'INDICATIVE PREMIUM' in details:
                    premium_str = details['INDICATIVE PREMIUM']
                
                if not premium_str:
                    # Skip plans without premium
                    continue
                
                annual_premium = parse_premium(premium_str)
                if annual_premium is None:
                    continue
                
                # Extract annual limit (aggregate limit/coverage amount)
                annual_limit = extract_aggregate_limit(details)
                if annual_limit is None:
                    annual_limit = 0.0
                
                # Extract network information
                tpa, network_name, network_type = self._extract_network_info(raw_plan)
                
                # Extract sub-limits using helper method
                inpatient_limit = self._extract_limit_from_details(details, ["inpatient", "in-patient"])
                outpatient_limit = self._extract_limit_from_details(details, ["outpatient", "out-patient"])
                maternity_limit = self._extract_limit_from_details(details, ["maternity", "pregnancy"])
                pharmacy_limit = self._extract_limit_from_details(details, ["pharmacy", "medicine", "medication"])
                dental_limit = self._extract_limit_from_details(details, ["dental", "teeth"])
                optical_limit = self._extract_limit_from_details(details, ["optical", "vision", "eye"])
                emergency_limit = self._extract_limit_from_details(details, ["emergency"])
                
                # Extract copays
                copays = self._extract_copays(details)
                
                # Extract coinsurance from copay if present
                coinsurance = 0
                if copays.get('general'):
                    percent_match = re.search(r'(\d+)%', copays['general'])
                    if percent_match:
                        coinsurance = int(percent_match.group(1))
                
                # Categorize benefits
                categorized_benefits = self._categorize_benefits(details)
                
                # Create plan code from plan name
                plan_code = plan_name.replace('Sukoon HealthPlus - ', '').replace(' ', '_').lower()
                
                # Create unique plan ID
                plan_id = f"{lead_id}_vendor-sukoon_{plan_code}"
                
                # Build comprehensive StandardPlan (UNIFIED STRUCTURE V2)
                standard_plan = {
                    # Core required fields
                    'id': plan_id,
                    'type': 'plan',
                    'leadId': lead_id,
                    'vendorId': 'vendor-sukoon',
                    'vendorName': 'Sukoon Insurance',
                    'vendorCode': 'SKN',
                    
                    # Basic Info
                    'planName': plan_name,
                    'planCode': plan_code,
                    'planType': 'Medical',
                    
                    # Pricing
                    'annualPremium': float(annual_premium),
                    'monthlyPremium': round(annual_premium / 12, 2) if annual_premium else 0.0,
                    'currency': 'AED',
                    
                    # Coverage Limits (required)
                    'annualLimit': float(annual_limit),
                    
                    # Cost Sharing
                    'deductible': 0.0,  # Sukoon plans typically don't show deductible in quick quote
                    'deductibleMetric': 'AED',
                    'coInsurance': float(coinsurance),
                    'coInsuranceMetric': '%',
                    'copays': copays,
                    
                    # Waiting Periods
                    'waitingPeriod': 30,  # Default waiting period
                    'waitingPeriodMetric': 'days',
                    'waitingPeriods': {'general': 30},
                    
                    # Benefits - structured format using semantic categorization
                    'benefits': categorized_benefits,
                    
                    # Exclusions
                    'exclusions': ['Subject to policy terms and conditions'],
                    
                    # Metadata
                    'lineOfBusiness': 'medical',
                    'lobSpecificData': {},
                    'isAvailable': True,
                    'isSelected': False,
                    'isRecommended': False,
                    'fetchRequestId': '',
                    'fetchedAt': datetime.now().isoformat(),
                    'source': 'rpa',
                    
                    # Raw Data (enhanced structure)
                    'rawPlanData': {
                        'plan_name': plan_name,
                        'premium': premium_str,
                        'network': network_name,
                        'tpa': tpa,
                        'coverage_details': self._clean_coverage_details(details),
                        'full_plan_data': raw_plan
                    }
                }
                
                # Add optional sub-limits only if extracted (don't hardcode zeros)
                if inpatient_limit is not None and inpatient_limit > 0:
                    standard_plan['inpatientLimit'] = float(inpatient_limit)
                if outpatient_limit is not None and outpatient_limit > 0:
                    standard_plan['outpatientLimit'] = float(outpatient_limit)
                if maternity_limit is not None and maternity_limit > 0:
                    standard_plan['maternityLimit'] = float(maternity_limit)
                if pharmacy_limit is not None and pharmacy_limit > 0:
                    standard_plan['pharmacyLimit'] = float(pharmacy_limit)
                if dental_limit is not None and dental_limit > 0:
                    standard_plan['dentalLimit'] = float(dental_limit)
                if optical_limit is not None and optical_limit > 0:
                    standard_plan['opticalLimit'] = float(optical_limit)
                if emergency_limit is not None and emergency_limit > 0:
                    standard_plan['emergencyLimit'] = float(emergency_limit)
                
                # Create network object if TPA or network data available (UNIFIED STRUCTURE V2)
                if tpa or network_name:
                    standard_plan['network'] = {
                        'tpa': tpa,
                        'networkName': network_name,
                        'networkType': network_type
                    }
                
                standard_plans.append(standard_plan)
            
            except Exception as e:
                # Log error but continue processing other plans
                print(f"Error normalizing Sukoon plan {idx}: {e}")
                continue
        
        return standard_plans
