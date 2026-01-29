"""
GIG Gulf Insurance Adapter
Handles data transformation for GIG Gulf Insurance portal
"""
from typing import Dict, Any, List
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter


class GigGulfAdapter(VendorAdapter):
    """
    Adapter for GIG Gulf Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to GIG Gulf-specific payload
    2. Transform GIG Gulf response (from parser) to StandardPlan
    """
    
    def __init__(self):
        super().__init__(vendor_id="gig-gulf", vendor_name="GIG Gulf Insurance")
    
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into GIG Gulf-specific payload format for form filling.
        
        GIG Gulf expects specific form field values as defined in the bot script.
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
        
        # Extract and format date of birth (DD/MM/YYYY format)
        dob_str = lob_data.get('dateOfBirth') or standard_lead.get('dob', '18/03/1998')
        if isinstance(dob_str, str) and dob_str:
            try:
                # Handle ISO format (YYYY-MM-DD) or datetime format
                if '-' in dob_str:
                    dob_obj = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
                    dob_str = dob_obj.strftime('%d/%m/%Y')
            except Exception:
                dob_str = '18/03/1998'  # Default fallback
        
        # Gender mapping
        gender_raw = lob_data.get('gender') or standard_lead.get('gender', 'Male')
        gender = gender_raw.capitalize() if isinstance(gender_raw, str) else 'Male'
        
        # Marital status mapping
        marital_status_raw = lob_data.get('maritalStatus') or standard_lead.get('maritalStatus', 'Single')
        marital_status = marital_status_raw.capitalize() if isinstance(marital_status_raw, str) else 'Single'
        
        # Nationality
        nationality = lob_data.get('nationality') or standard_lead.get('nationality', 'Indian')
        
        # State/Emirate
        state = standard_lead.get('emirate') or lob_data.get('state', 'Abu Dhabi')
        
        # Visa location (same as state by default)
        visa_location = lob_data.get('visaLocation', state)
        
        # Passport country
        passport_country = lob_data.get('passportCountry', 'India')
        
        # Work location
        work_location = lob_data.get('workLocation', 'BUISNESS BAY')
        
        # Occupation
        occupation = lob_data.get('occupation') or standard_lead.get('occupation', 'Accountant')
        
        # Email
        email = standard_lead.get('email', 'test@gmail.com')
        
        # Salary range mapping
        salary_range_raw = lob_data.get('salaryRange', '')
        salary_range_mapping = {
            'Less than 5000': '<=4000 AED/month',
            '5000-10000': '>4000 and <=12000 AED/month',
            '10000-20000': '>12000 and <=20000 AED/month',
            '20000-50000': '>20000 AED/month',
            'Above 50000': '>20000 AED/month'
        }
        salary_range = salary_range_mapping.get(salary_range_raw, '>4000 and <=12000 AED/month')
        
        # Visa type
        visa_type = lob_data.get('visaType', 'Resident visa')
        
        # Build GIG Gulf-specific payload
        return {
            'leadId': lead_id,  # Pass through for tracking
            'first_name': first_name or 'Guest',
            'last_name': last_name or 'User',
            'email': email,
            'dob': dob_str,
            'gender': gender,
            'marital_status': marital_status,
            'nationality': nationality,
            'state': state,
            'visa_location': visa_location,
            'passport_country': passport_country,
            'work_location': work_location,
            'occupation': occupation,
            'salary_range': salary_range,
            'visa_type': visa_type
        }
    
    def normalize_response(self, raw_vendor_data: Any, lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw GIG Gulf data into StandardPlan format.
        
        The GigGulfParser already outputs plans in StandardPlan format,
        so this method just validates and passes through.
        """
        # If raw_vendor_data is already a list (from parser), return it
        if isinstance(raw_vendor_data, list):
            return raw_vendor_data
        
        # Otherwise, return empty list
        return []
