"""
GIG Gulf Insurance Adapter
Handles data transformation for GIG Gulf Insurance portal
"""
from typing import Dict, Any, List
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter


class Gig_gulfAdapter(VendorAdapter):
    """
    Adapter for GIG Gulf Insurance portal.
    
    Responsibilities:
    1. Transform StandardLead to GIG Gulf-specific payload
    2. Transform GIG Gulf response (from parser) to StandardPlan
    """
    
    def __init__(self):
        super().__init__(vendor_id="gig-gulf", vendor_name="GIG Gulf Insurance")
    
    def _map_relationship_to_giggulf(self, relationship: str, gender: str) -> str:
        """
        Map standard relationship types to GIG Gulf portal values
        """
        mapping = {
            ('Spouse', 'Female'): 'Wife',
            ('Spouse', 'Male'): 'Husband',
            ('Child', 'Female'): 'Daughter',
            ('Child', 'Male'): 'Son',
            ('Parent', 'Female'): 'Mother',
            ('Parent', 'Male'): 'Father'
        }
        return mapping.get((relationship, gender), relationship)
    
    def _infer_marital_status(self, relationship: str, dob_str: str) -> str:
        """
        Infer marital status based on relationship and age
        """
        # Spouse is always Married
        if relationship == 'Spouse':
            return 'Married'
        
        # Calculate age from DOB
        try:
            age = self._calculate_age(dob_str)
            if age < 18:
                return 'Single'
        except:
            pass
        
        return 'Single'  # Default
    
    def _calculate_age(self, dob_str: str) -> int:
        """
        Calculate age from date of birth string
        """
        try:
            # Handle ISO format (YYYY-MM-DD)
            if '-' in dob_str and len(dob_str) >= 10:
                dob_obj = datetime.fromisoformat(dob_str.split('T')[0])
            # Handle DD/MM/YYYY format
            elif '/' in dob_str:
                parts = dob_str.split('/')
                if len(parts) == 3:
                    dob_obj = datetime(int(parts[2]), int(parts[1]), int(parts[0]))
                else:
                    return 25  # Default age
            else:
                return 25  # Default age
            
            today = datetime.now()
            age = today.year - dob_obj.year - ((today.month, today.day) < (dob_obj.month, dob_obj.day))
            return age
        except Exception:
            return 25  # Default age if parsing fails
    
    def _format_date_for_giggulf(self, date_str: str) -> str:
        """
        Format date to DD/MM/YYYY format for GIG Gulf portal
        """
        if not date_str:
            return ''
        
        try:
            # Handle ISO format (YYYY-MM-DD)
            if '-' in date_str and len(date_str) >= 10:
                date_obj = datetime.fromisoformat(date_str.split('T')[0])
                return date_obj.strftime('%d/%m/%Y')
            # Already in DD/MM/YYYY format
            elif '/' in date_str:
                return date_str
            else:
                return date_str
        except Exception:
            return date_str
    
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
        dob_str = lob_data.get('dateOfBirth') or standard_lead.get('dob', '18/04/1998')
        if isinstance(dob_str, str) and dob_str:
            try:
                # Handle ISO format (YYYY-MM-DD) or datetime format
                if '-' in dob_str:
                    dob_obj = datetime.fromisoformat(dob_str.replace('Z', '+00:00'))
                    dob_str = dob_obj.strftime('%d/%m/%Y')
            except Exception:
                dob_str = '18/04/1998'  # Default fallback
        
        # Extract and format effective date (coverage start date) - DD/MM/YYYY format
        effective_date_str = lob_data.get('effectiveDate') or lob_data.get('coverageStartDate') or standard_lead.get('effectiveDate', '31/01/2026')
        if isinstance(effective_date_str, str) and effective_date_str:
            try:
                # Handle ISO format (YYYY-MM-DD) or datetime format
                if '-' in effective_date_str:
                    effective_date_obj = datetime.fromisoformat(effective_date_str.replace('Z', '+00:00'))
                    effective_date_str = effective_date_obj.strftime('%d/%m/%Y')
                # If it's already in DD/MM/YYYY format, keep it
            except Exception:
                effective_date_str = '31/01/2026'  # Default fallback
        else:
            effective_date_str = '31/01/2026'  # Default if not provided
        
        # Extract phone number
        phone_dict = standard_lead.get('phone', {})
        phone_number = self._extract_phone_number(phone_dict)
        
        # Format for GIG Gulf: +971 XX XXXXXXX (country code + space + mobile)
        if phone_number:
            # Remove all special characters and spaces
            phone_number = phone_number.replace('+971', '').replace('971', '').replace('-', '').replace(' ', '').replace('(', '').replace(')', '').strip()
            
            # Remove leading 0 if present (we'll add country code)
            if phone_number.startswith('0'):
                phone_number = phone_number[1:]
            
            # Ensure we have 9 digits after country code
            if len(phone_number) == 9:
                # Format as +971 XX XXXXXXX
                phone_number = f"+971 {phone_number[:2]} {phone_number[2:]}"
            else:
                # Default if format is wrong
                phone_number = "+971 50 1234567"
        else:
            phone_number = "+971 50 1234567"  # Default with country code
        
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
        work_location = lob_data.get('workLocation', 'AL KARAMA')
        
        # Occupation
        occupation = lob_data.get('occupation') or standard_lead.get('occupation', 'Accountant')
        
        # Email
        email = standard_lead.get('email', 'test@gmail.com')
        
        # Salary range mapping
        # Available options in GIG Gulf portal:
        # - <=4000 AED/month
        # - >4000 and <=12000 AED/month
        # - >12000 AED/month
        # - No Salary
        # - No salary-Commission only
        salary_range_raw = lob_data.get('salaryRange', '')
        salary_range_mapping = {
            'Less than 5000': '<=4000 AED/month',
            '5000-10000': '>4000 and <=12000 AED/month',
            '10000-20000': '>12000 AED/month',  # Fixed: portal only has ">12000 AED/month", not ">12000 and <=20000"
            '20000-50000': '>12000 AED/month',  # Maps to same option
            'Above 50000': '>12000 AED/month'  # Maps to same option
        }
        salary_range = salary_range_mapping.get(salary_range_raw, '>4000 and <=12000 AED/month')
        
        # Visa type
        visa_type = lob_data.get('visaType', 'Resident visa')
        
        # Extract and process dependents
        dependents_list = []
        lead_dependents = lob_data.get('dependents', [])
        
        if lead_dependents and isinstance(lead_dependents, list):
            for dep in lead_dependents:
                # Extract dependent fields
                dep_name = dep.get('name', '')
                dep_relationship = dep.get('relationship', 'Child')
                dep_dob = dep.get('dateOfBirth', '')
                dep_gender = dep.get('gender', 'Male')
                
                # Format date
                dep_dob_formatted = self._format_date_for_giggulf(dep_dob)
                
                # Determine title based on gender
                dep_title = 'MS' if dep_gender == 'Female' else 'MR'
                
                # Map relationship to GIG Gulf format
                dep_relation = self._map_relationship_to_giggulf(dep_relationship, dep_gender)
                
                # Infer marital status
                dep_marital_status = self._infer_marital_status(dep_relationship, dep_dob)
                
                # Build dependent object
                dependent_data = {
                    'title': dep_title,
                    'full_name': dep_name,
                    'dob': dep_dob_formatted or '01/01/2000',
                    'gender': dep_gender,
                    'relation': dep_relation,
                    'marital_status': dep_marital_status,
                    'nationality': nationality  # Inherit from primary member
                }
                
                dependents_list.append(dependent_data)
        
        # Calculate number of dependents
        num_dependents = lob_data.get('numberOfDependents', len(dependents_list))
        
        # Build GIG Gulf-specific payload
        return {
            'leadId': lead_id,  # Pass through for tracking
            'first_name': first_name or 'Guest',
            'last_name': last_name or 'User',
            'email': email,
            'phone': phone_number,  # Phone number added
            'dob': dob_str,
            'effective_date': effective_date_str,  # Coverage start date
            'gender': gender,
            'marital_status': marital_status,
            'nationality': nationality,
            'state': state,
            'visa_location': visa_location,
            'passport_country': passport_country,
            'work_location': work_location,
            'occupation': occupation,
            'salary_range': salary_range,
            'visa_type': visa_type,
            'dependents': dependents_list,  # List of dependents
            'numberOfDependents': num_dependents  # Count of dependents
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
