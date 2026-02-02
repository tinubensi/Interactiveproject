"""
Takaful Emarat Adapter
Handles data transformation for Takaful Emarat Insurance portal
"""
import sys
from typing import Dict, Any, List
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter


class TakafulAdapter(VendorAdapter):
    """
    Adapter for Takaful Emarat Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to Takaful-specific payload
    2. Transform Takaful response (from parser) to StandardPlan
    """
    
    def __init__(self):
        super().__init__(vendor_id="vendor-takaful", vendor_name="Takaful Emarat")
    
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into Takaful-specific payload format for form filling.
        
        Takaful expects specific formats for form fields as defined in the bot script.
        Extracts data from lobData object which contains medical-specific fields.
        """
        # Extract lobData (medical-specific fields)
        lob_data = standard_lead.get('lobData', {})
        
        # Extract lead ID
        lead_id = standard_lead.get('leadId') or standard_lead.get('id', 'unknown')
        
        # Extract name fields
        first_name = standard_lead.get('firstName', '')
        family_name = standard_lead.get('lastName', '')
        
        # If not provided, extract from fullName
        if not first_name or not family_name:
            full_name = standard_lead.get('fullName', '')
            name_parts = full_name.split()
            if len(name_parts) > 0:
                first_name = name_parts[0]
            if len(name_parts) > 1:
                # Last name is everything after first name
                family_name = ' '.join(name_parts[1:])
        
        # Format date of birth to components (year, month, day)
        dob_str = lob_data.get('dateOfBirth') or standard_lead.get('dob', '')
        dob_dict = {"year": 1990, "month": 5, "day": 10}  # Default
        
        if isinstance(dob_str, str) and dob_str:
            try:
                # Handle ISO format (YYYY-MM-DD) or datetime format
                dob_obj = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
                dob_dict = {
                    "year": dob_obj.year,
                    "month": dob_obj.month,
                    "day": dob_obj.day
                }
            except Exception:
                # Keep default if parsing fails
                pass
        
        # Extract phone number
        phone_dict = standard_lead.get('phone', {})
        phone_number = self._extract_phone_number(phone_dict)
        
        # Takaful expects UAE mobile numbers without country code
        # Remove +971 or 971 prefix if present
        if phone_number:
            phone_number = phone_number.strip()
            if phone_number.startswith('+971'):
                phone_number = phone_number[4:]
            elif phone_number.startswith('971'):
                phone_number = phone_number[3:]
        
        # Extract gender from lobData or root - ensure proper capitalization
        gender_raw = lob_data.get('gender') or standard_lead.get('gender', 'Male')
        # Capitalize first letter to match portal buttons (Male/Female)
        gender = gender_raw.capitalize() if isinstance(gender_raw, str) else 'Male'
        
        # Extract nationality with fallback
        nationality = lob_data.get('nationality') or standard_lead.get('nationality', 'United Arab Emirates')
        
        # Extract marital status - capitalize to match portal
        marital_status_raw = lob_data.get('maritalStatus') or standard_lead.get('maritalStatus', 'Single')
        marital_status = marital_status_raw.capitalize() if isinstance(marital_status_raw, str) else 'Single'
        
        # Extract sponsor type - map from visaType if not provided
        sponsor_type = lob_data.get('sponsorType')
        if not sponsor_type:
            # Map visaType to sponsor_type
            visa_type = lob_data.get('visaType')
            visa_to_sponsor_mapping = {
                'Employment': 'Resident',
                'Residence': 'Resident',
                'Investor': 'Investor',
                'Student': 'Student',
                'Tourist': 'Tourist'
            }
            sponsor_type = visa_to_sponsor_mapping.get(visa_type, 'Resident')
        
        # Extract salary range - map schema values to Takaful portal options
        # Takaful portal options (verified from logs): "4001-12000 AED/Month", ">12000 AED/Month"
        # Note: "Less than 5000" does NOT exist in portal - map to lowest available option
        
        # Check multiple possible field names (prioritize new portal codes)
        salary_raw = (
            lob_data.get('monthlySalaryRange') or 
            form_data.get('monthlySalaryRange') or 
            lob_data.get('salaryRange') or 
            'Less than 5000'
        )
        
        # Handle new portal codes (22, 23, 24)
        if str(salary_raw) in ['22', '23', '24']:
            portal_code_mapping = {
                '22': '4001-12000 AED/Month',  # Less than 4,000 -> map to lowest
                '23': '4001-12000 AED/Month',  # 4,000 - 12,000 AED
                '24': '>12000 AED/Month'       # Greater than 12,000 AED
            }
            salary_range = portal_code_mapping.get(str(salary_raw), '4001-12000 AED/Month')
            print(f"✓ Takaful: Mapped portal code {salary_raw} to {salary_range}", file=sys.stderr)
        else:
            # Old text format mapping (backward compatibility)
            salary_mapping = {
                'Less than 5000': '4001-12000 AED/Month',  # Map to lowest available option
                '5000-10000': '4001-12000 AED/Month',
                '10000-20000': '4001-12000 AED/Month',
                '20000-50000': '>12000 AED/Month',
                'Above 50000': '>12000 AED/Month'
            }
            # Default to lowest option if unmapped value (safe fallback)
            salary_range = salary_mapping.get(salary_raw, '4001-12000 AED/Month')
            if salary_raw:
                print(f"✓ Takaful: Mapped text '{salary_raw}' to {salary_range}", file=sys.stderr)
        
        # Extract emirate
        emirate = standard_lead.get('emirate', 'Dubai')
        
        # Build Takaful-specific payload (matches bot form fields)
        return {
            'leadId': lead_id,  # Pass through for tracking
            'first_name': first_name or 'Customer',
            'family_name': family_name or 'User',
            'dob': dob_dict,
            'gender': gender,  # Now properly capitalized
            'nationality': nationality,  # Added for completeness
            'marital_status': marital_status,  # Now properly capitalized
            'email': standard_lead.get('email', 'customer@example.com'),
            'phone': phone_number or '501234567',
            'emirate': emirate,
            'sponsor_type': sponsor_type,  # Mapped from visaType if needed
            'salary': salary_range  # Mapped to portal format
        }
    
    def normalize_response(self, raw_vendor_data: Dict[str, Any], lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw Takaful data into StandardPlan format.
        
        The TakafulDataParser already outputs plans in StandardPlan format,
        so this method just validates and passes through.
        """
        # If raw_vendor_data is already a list (from parser), return it
        if isinstance(raw_vendor_data, list):
            return raw_vendor_data
        
        # Otherwise, return empty list
        return []

