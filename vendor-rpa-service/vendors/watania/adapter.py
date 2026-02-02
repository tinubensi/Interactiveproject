"""
Watania Takaful Adapter
Handles data transformation for Watania Insurance portal
"""
import sys
from typing import Dict, Any, List
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter


class WataniaAdapter(VendorAdapter):
    """
    Adapter for Watania Takaful Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to Watania-specific payload
    2. Transform Watania response (from parser) to StandardPlan
    """
    
    def __init__(self):
        super().__init__(vendor_id="watania", vendor_name="Watania Takaful")
    
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into Watania-specific payload format for form filling.
        
        Watania expects specific formats for form fields as defined in the bot script.
        Extracts data from lobData object which contains medical-specific fields.
        """
        # Extract lobData (medical-specific fields)
        lob_data = standard_lead.get('lobData', {})
        
        # Format date of birth to DD-MM-YYYY (Watania format)
        # Try lobData.dateOfBirth first, then fallback to dob
        dob_str = lob_data.get('dateOfBirth') or standard_lead.get('dob', '')
        if isinstance(dob_str, str) and dob_str:
            try:
                # Handle both ISO format (YYYY-MM-DD) and datetime format
                dob_obj = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
                dob_formatted = dob_obj.strftime('%d-%m-%Y')
            except Exception:
                dob_formatted = dob_str
        else:
            dob_formatted = '01-01-1990'  # Default
        
        # Extract phone number
        phone_dict = standard_lead.get('phone', {})
        phone_number = self._extract_phone_number(phone_dict)
        
        # Watania expects UAE mobile numbers in format: 0501234567
        # Add leading 0 if not present
        if phone_number and not phone_number.startswith('0'):
            phone_number = '0' + phone_number
        
        # Get lead ID
        lead_id = standard_lead.get('leadId') or standard_lead.get('id', 'unknown')
        
        # Extract gender from lobData or root
        gender = lob_data.get('gender') or standard_lead.get('gender', 'Male')
        
        # Extract nationality from lobData
        nationality = lob_data.get('nationality', 'United Arab Emirates')
        
        # Extract optional fields from lobData with smart defaults
        emirates_id = lob_data.get('emiratesId', '784-0000-0000000-0')
        visa_type = lob_data.get('visaType', 'Employment')
        marital_status = lob_data.get('maritalStatus', 'Single')
        
        # Check multiple possible field names for salary (prioritize new portal codes)
        salary_range = (
            lob_data.get('monthlySalaryRange') or 
            form_data.get('monthlySalaryRange') or 
            lob_data.get('salaryRange') or 
            'Less than 5000'
        )
        
        # Handle new portal codes (22, 23, 24)
        if str(salary_range) in ['22', '23', '24']:
            portal_code_mapping = {
                '22': 'Less than or equal to AED',      # Less than 4,000 AED
                '23': 'From 10,001 AED to 20,000 AED',  # 4,000 - 12,000 AED
                '24': 'More than 50,000 AED'            # Greater than 12,000 AED
            }
            salary_watania = portal_code_mapping.get(str(salary_range), 'Less than or equal to AED')
            print(f"✓ Watania: Mapped portal code {salary_range} to {salary_watania}", file=sys.stderr)
        else:
            # Map salary range to Watania format (old text format - backward compatibility)
            salary_mapping = {
                'Less than 5000': 'Less than or equal to AED',
                '5000-10000': 'Less than or equal to AED',
                '10000-20000': 'From 10,001 AED to 20,000 AED',
                '20000-50000': 'From 20,001 AED to 50,000 AED',
                'Above 50000': 'More than 50,000 AED'
            }
            salary_watania = salary_mapping.get(salary_range, 'Less than or equal to AED')
            if salary_range:
                print(f"✓ Watania: Mapped text '{salary_range}' to {salary_watania}", file=sys.stderr)
        
        # Determine member type based on nationality
        if nationality in ['United Arab Emirates', 'UAE']:
            member_type = 'UAE National'
        elif nationality in ['Saudi Arabia', 'Kuwait', 'Bahrain', 'Oman', 'Qatar']:
            member_type = 'GCC National'
        else:
            member_type = 'Expat'
        
        # Build Watania-specific payload (matches bot form fields)
        return {
            'leadId': lead_id,  # Pass through for tracking
            'covered_for': 'Self',
            'emirates_id': emirates_id,
            'full_name': standard_lead.get('fullName', f"{standard_lead.get('firstName', '')} {standard_lead.get('lastName', '')}".strip()),
            'email': standard_lead.get('email', ''),
            'mobile': phone_number,
            'city': standard_lead.get('emirate', 'Dubai'),
            'salary': salary_watania,
            'date_of_birth': dob_formatted,
            'nationality': nationality,
            'marital_status': marital_status,
            'gender': gender,
            'member_type': member_type,
            'residency_emirate': standard_lead.get('emirate', 'Dubai'),  # For Expat residency disambiguation
            'visa_type': visa_type,
            'residential_location': standard_lead.get('emirate', 'Dubai'),
            'currently_insured': 'Yes' if lob_data.get('currentlyInsured') else 'No',
            'passport_number': lob_data.get('passportNumber', 'A00000000'),
            'visa_file_number': lob_data.get('visaFileNumber', 'V00000000'),
            'visa_expiry_date': lob_data.get('visaExpiryDate', '31-12-2025'),
            'member_uid': f"M{lead_id[:8]}" if len(lead_id) > 8 else 'M00000000',
            'address': lob_data.get('address', f"{standard_lead.get('emirate', 'Dubai')}, UAE")
        }
    
    def normalize_response(self, raw_vendor_data: Dict[str, Any], lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw Watania data into StandardPlan format.
        
        The WataniaDataParser already outputs plans in StandardPlan format,
        so this method just validates and passes through.
        """
        # If raw_vendor_data is already a list (from parser), return it
        if isinstance(raw_vendor_data, list):
            return raw_vendor_data
        
        # Otherwise, return empty list
        return []
