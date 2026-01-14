"""
Alsagr Insurance Adapter
Handles data transformation for Alsagr Insurance portal
"""
from typing import Dict, Any, List
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter


class AlsagrAdapter(VendorAdapter):
    """
    Adapter for Alsagr Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to Alsagr-specific payload
    2. Transform Alsagr response (from parser) to StandardPlan
    """
    
    def __init__(self):
        super().__init__(vendor_id="alsagr", vendor_name="Alsagr Insurance")
    
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into Alsagr-specific payload format for form filling.
        
        Alsagr expects specific form field values as defined in the browser script.
        """
        # Extract lobData (medical-specific fields)
        lob_data = standard_lead.get('lobData', {})
        
        # Extract lead ID
        lead_id = standard_lead.get('leadId') or standard_lead.get('id', 'unknown')
        
        # Extract name fields
        first_name = standard_lead.get('firstName', '')
        last_name = standard_lead.get('lastName', '')
        
        # If not provided, extract from fullName
        if not first_name or not last_name:
            full_name = standard_lead.get('fullName', '')
            name_parts = full_name.split()
            if len(name_parts) > 0:
                first_name = name_parts[0]
            if len(name_parts) > 1:
                last_name = ' '.join(name_parts[1:])
        
        # Extract phone number
        phone_dict = standard_lead.get('phone', {})
        phone_number = self._extract_phone_number(phone_dict)
        
        # UAE mobile format - ensure it starts with 05
        if phone_number and not phone_number.startswith('05'):
            # Try to extract UAE mobile from various formats
            phone_number = phone_number.replace('+971', '').replace('971', '').strip()
            if not phone_number.startswith('0'):
                phone_number = '0' + phone_number
        
        # Format date of birth to YYYY-MM-DD
        dob_str = lob_data.get('dateOfBirth') or standard_lead.get('dob', '2000-01-01')
        if isinstance(dob_str, str) and dob_str:
            try:
                # Handle ISO format (YYYY-MM-DD) or datetime format
                dob_obj = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
                dob_str = dob_obj.strftime('%Y-%m-%d')
            except Exception:
                dob_str = '2000-01-01'  # Default fallback
        
        # Emirate mapping (from browser_actions.py line 42)
        emirate = standard_lead.get('emirate', 'Dubai')
        emirate_mapping = {
            'Dubai': '13',
            'Abu Dhabi': '12',
            'Sharjah': '14',
            'Ajman': '15',
            'Umm Al Quwain': '16',
            'Ras Al Khaimah': '17',
            'Fujairah': '18'
        }
        visa_emirate = emirate_mapping.get(emirate, '13')  # Default to Dubai
        
        # Salary band mapping (from browser_actions.py line 43)
        # Defaulting to "23" as in the script
        salary_mapping = {
            'Less than 5000': '23',
            '5000-10000': '23',
            '10000-20000': '24',
            '20000-50000': '25',
            'Above 50000': '26'
        }
        salary_range = lob_data.get('salaryRange', 'Less than 5000')
        salary_band = salary_mapping.get(salary_range, '23')
        
        # Gender mapping (from browser_actions.py line 49)
        gender_raw = lob_data.get('gender') or standard_lead.get('gender', 'Male')
        gender_mapping = {
            'Male': '190',
            'Female': '191'
        }
        gender = gender_mapping.get(gender_raw.capitalize() if isinstance(gender_raw, str) else 'Male', '190')
        
        # Marital status mapping (from browser_actions.py line 50)
        marital_status_raw = lob_data.get('maritalStatus') or standard_lead.get('maritalStatus', 'Single')
        marital_mapping = {
            'Single': '21',
            'Married': '22',
            'Divorced': '23',
            'Widowed': '24'
        }
        marital_status = marital_mapping.get(marital_status_raw.capitalize() if isinstance(marital_status_raw, str) else 'Single', '21')
        
        # Build Alsagr-specific payload (matches bot form fields)
        return {
            'leadId': lead_id,  # Pass through for tracking
            'first_name': first_name or 'Guest',
            'last_name': last_name or 'User',
            'email': standard_lead.get('email', 'demo@gmail.com'),
            'phone': phone_number or '0502503969',
            'dob': dob_str,
            'visaEmirate': visa_emirate,
            'salaryBand': salary_band,
            'gender': gender,
            'maritalStatus': marital_status
        }
    
    def normalize_response(self, raw_vendor_data: Any, lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw Alsagr data into StandardPlan format.
        
        The AlsagrParser already outputs plans in StandardPlan format,
        so this method just validates and passes through.
        """
        # If raw_vendor_data is already a list (from parser), return it
        if isinstance(raw_vendor_data, list):
            return raw_vendor_data
        
        # Otherwise, return empty list
        return []
