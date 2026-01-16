"""
Sukoon Insurance Adapter
Handles data transformation for Sukoon Insurance portal
"""
from typing import Dict, Any, List
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter
from vendors.sukoon.parser import (
    clean_number, parse_coverage, parse_benefit, 
    parse_premium, extract_network_type, extract_aggregate_limit
)


class SukoonAdapter(VendorAdapter):
    """
    Adapter for Sukoon Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to Sukoon-specific payload
    2. Transform Sukoon response to StandardPlan
    """
    
    def __init__(self):
        super().__init__(vendor_id="sukoon", vendor_name="Sukoon Insurance")
    
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into Sukoon-specific payload format for form filling.
        
        Sukoon expects specific form field values as defined in the browser script.
        """
        # Extract lobData (medical-specific fields)
        lob_data = standard_lead.get('lobData', {})
        
        # Extract lead ID
        lead_id = standard_lead.get('leadId') or standard_lead.get('id', 'unknown')
        
        # Get date of birth
        dob_str = lob_data.get('dateOfBirth') or standard_lead.get('dob', '1996-06-15')
        
        # Calculate age from DOB for form filling
        try:
            if isinstance(dob_str, str):
                dob_obj = datetime.fromisoformat(dob_str.replace('Z', '+00:00').split('T')[0])
                age = (datetime.now() - dob_obj).days // 365
            else:
                age = 30  # Default
        except Exception:
            age = 30  # Default fallback
        
        # Visa Type mapping for Sukoon dropdown
        # Options: 1-6 (need to discover exact mappings from portal)
        visa_type_raw = lob_data.get('visaType') or standard_lead.get('visaType', 'citizen')
        visa_type_mapping = {
            'resident': '1',
            'citizen': '5',      # UAE/GCC National
            'gcc_national': '5',
            'dependent': '2',
            'visit_visa': '3'
        }
        visa_type = visa_type_mapping.get(visa_type_raw.lower() if isinstance(visa_type_raw, str) else 'citizen', '5')
        
        # Gender mapping
        gender_raw = lob_data.get('gender') or standard_lead.get('gender', 'Male')
        gender = gender_raw.lower() if isinstance(gender_raw, str) else 'male'
        
        # Marital status mapping for Sukoon dropdown
        marital_status_raw = lob_data.get('maritalStatus') or standard_lead.get('maritalStatus', 'Single')
        marital_mapping = {
            'single': '1',
            'married': '2',
            'divorced': '3',
            'widowed': '4'
        }
        marital_status = marital_mapping.get(marital_status_raw.lower() if isinstance(marital_status_raw, str) else 'single', '1')
        
        # Nationality mapping to GUID
        # Sukoon uses GUIDs for nationalities
        nationality_raw = lob_data.get('nationality') or standard_lead.get('nationality', 'UAE')
        nationality_guid_mapping = {
            'uae': 'a275c17e-afe4-e611-80c9-005056bd7a8d',
            'united arab emirates': 'a275c17e-afe4-e611-80c9-005056bd7a8d',
            # Add more nationalities as needed by inspecting portal dropdown
        }
        nationality = nationality_guid_mapping.get(
            nationality_raw.lower() if isinstance(nationality_raw, str) else 'uae',
            'a275c17e-afe4-e611-80c9-005056bd7a8d'  # Default to UAE
        )
        
        # Build Sukoon-specific payload (matches bot form fields)
        return {
            'leadId': lead_id,  # Pass through for tracking
            'dob': dob_str,
            'age': age,
            'gender': gender,
            'visaType': visa_type,
            'maritalStatus': marital_status,
            'nationality': nationality
        }
    
    def normalize_response(self, raw_vendor_data: Any, lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw Sukoon data into StandardPlan format.
        
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
                
                # Extract coverage amount (aggregate limit)
                coverage_amount = extract_aggregate_limit(details)
                if coverage_amount is None:
                    coverage_amount = 0.0  # Default if not found
                
                # Extract network type
                network_type = extract_network_type(details)
                
                # Extract maternity benefit
                maternity_str = details.get('Maternity Benefits') or details.get('MATERNITY BENEFITS')
                maternity_limit = parse_benefit(maternity_str) if maternity_str else None
                
                # Extract dental limit
                dental_str = details.get('Dental Plan Limit (Annual)') or details.get('DENTAL PLAN LIMIT (ANNUAL)')
                dental_limit = parse_benefit(dental_str) if dental_str else None
                
                # Extract optical coverage
                optical_str = details.get('Optical Plan Coverage') or details.get('OPTICAL PLAN COVERAGE')
                optical_covered = optical_str not in ['X', '✘', 'x', None, '']
                
                # Extract alternative medicine limit
                alt_medicine_str = details.get('Alternate Medicine Limit (Annual)')
                alt_medicine_limit = parse_benefit(alt_medicine_str) if alt_medicine_str else None
                
                # Build benefits list
                benefits = []
                if network_type:
                    benefits.append(f"Network: {network_type}")
                if maternity_limit and isinstance(maternity_limit, (int, float)) and maternity_limit > 0:
                    benefits.append(f"Maternity: AED {maternity_limit:,.0f}")
                if dental_limit and isinstance(dental_limit, (int, float)) and dental_limit > 0:
                    benefits.append(f"Dental: AED {dental_limit:,.0f}")
                if optical_covered:
                    benefits.append(f"Optical: {optical_str}")
                if alt_medicine_limit and isinstance(alt_medicine_limit, (int, float)) and alt_medicine_limit > 0:
                    benefits.append(f"Alternative Medicine: AED {alt_medicine_limit:,.0f}")
                
                # Extract coverage territory
                territory = details.get('Basic Coverage Territory') or details.get('BASIC COVERAGE TERRITORY')
                if territory:
                    benefits.append(f"Coverage: {territory}")
                
                # Create plan code from plan name
                plan_code = plan_name.replace('Sukoon HealthPlus - ', '').replace(' ', '_').lower()
                
                # Create unique plan ID
                plan_id = f"{lead_id}_vendor-sukoon_{plan_code}"
                
                # Create StandardPlan
                standard_plan = {
                    'id': plan_id,
                    'leadId': lead_id,
                    'vendorId': 'vendor-sukoon',
                    'vendorName': 'Sukoon Insurance',
                    'planName': plan_name,
                    'planCode': plan_code,
                    'planType': 'Medical',
                    'annualPremium': annual_premium,
                    'monthlyPremium': round(annual_premium / 12, 2) if annual_premium else None,
                    'currency': 'AED',
                    'coverageAmount': coverage_amount,
                    'deductible': 0.0,  # Sukoon plans typically don't show deductible in quick quote
                    'coInsurance': None,
                    'waitingPeriod': None,
                    'benefits': benefits,
                    'exclusions': [],  # Would need to extract from detailed view
                    'fetchedAt': datetime.now().isoformat(),
                    'rawData': raw_plan  # Store raw data for debugging
                }
                
                standard_plans.append(standard_plan)
            
            except Exception as e:
                # Log error but continue processing other plans
                print(f"Error normalizing plan {idx}: {e}")
                continue
        
        return standard_plans
