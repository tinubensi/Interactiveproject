"""
Alsagr Portal Data Adapter
Transforms lead service data format to Alsagr portal-specific format
"""
import sys
from typing import Dict, Any, List


class AlsagrAdapter:
    """
    Adapter class for transforming lead service data to Alsagr portal format
    Used by the vendor-rpa-service CLI
    """
    
    def prepare_vendor_payload(self, lead_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Prepare vendor payload from lead data
        This is the main entry point called by cli.py
        
        Args:
            lead_data: Lead data from lead service
            
        Returns:
            Dictionary formatted for Alsagr bot
        """
        # #region agent log - Hypothesis A: Check input to adapter
        import json
        from datetime import datetime
        import os
        log_dir = os.environ.get('LOG_DIR', '/tmp')
        log_path = os.path.join(log_dir, 'alsagr_debug.log')
        try:
            lob_data = lead_data.get('lobData', {})
            raw_deps = lob_data.get('dependents', [])
            with open(log_path, 'a') as f:
                f.write(json.dumps({"sessionId":"debug-session","runId":"initial","hypothesisId":"A","location":"adapter.py:25","message":"Adapter received lead","data":{"hasLobData":"lobData" in lead_data,"rawDependents":raw_deps,"rawDependentsCount":len(raw_deps)},"timestamp":int(datetime.utcnow().timestamp()*1000)}) + '\n')
        except: pass
        # #endregion
        
        return transform_lead_to_alsagr_format(lead_data)
    
    def normalize_response(self, plans: List[Dict[str, Any]], lead_id: str) -> List[Dict[str, Any]]:
        """
        Normalize plan data to standard format
        
        Args:
            plans: List of enriched plan data from bot
            lead_id: The lead ID to attach to plans
            
        Returns:
            List of normalized plans with consistent structure
        """
        normalized = []
        
        for plan in plans:
            # Add lead ID if not present OR if it's null/empty
            if 'leadId' not in plan or not plan.get('leadId') or plan.get('leadId') == 'null':
                plan['leadId'] = lead_id
            
            # Ensure required vendor fields exist
            if 'vendorId' not in plan:
                plan['vendorId'] = 'vendor-alsagr'
            
            if 'vendorCode' not in plan:
                plan['vendorCode'] = 'alsagr'
            
            if 'vendorName' not in plan:
                plan['vendorName'] = 'Alsagr Insurance'
            
            # Ensure type field exists
            if 'type' not in plan:
                plan['type'] = 'plan'
            
            # CRITICAL: Ensure planCode or id exists for database save
            if 'planCode' not in plan or not plan.get('planCode') or plan.get('planCode') == 'ASG-PLA-XX':
                # Generate planCode from planName if available
                if 'planName' in plan and plan.get('planName') and plan.get('planName') != 'Unknown Plan':
                    import re
                    plan['planCode'] = f"ASG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', str(plan['planName']))[:50]}"
                elif 'id' in plan and plan.get('id'):
                    # Use id as fallback
                    plan['planCode'] = plan['id'].replace('plan-', 'ASG-PLA-')
                else:
                    # Last resort: generate UUID-based planCode
                    import uuid
                    plan['planCode'] = f"ASG-PLA-{str(uuid.uuid4())[:8]}"
            
            # Ensure id exists (use planCode if id is missing)
            if 'id' not in plan or not plan.get('id'):
                plan['id'] = f"plan-{plan.get('planCode', 'unknown')}"
            
            normalized.append(plan)
        
        return normalized


def format_phone_for_portal(phone: str) -> str:
    """
    Format phone number for Alsagr portal
    Portal expects: "05XXXXXXXX" format (10 digits starting with 0)
    
    Input can be:
    - "+971502503868"
    - "971502503868"
    - "0502503868"
    
    Args:
        phone: Phone number in any format
        
    Returns:
        Formatted phone number "05XXXXXXXX"
    """
    if not phone:
        return ''
    
    # Remove all non-digits
    digits = ''.join(c for c in phone if c.isdigit())
    
    # If starts with 971 (country code), remove it
    if digits.startswith('971'):
        digits = digits[3:]
    
    # Ensure it starts with 0
    if not digits.startswith('0'):
        digits = '0' + digits
    
    return digits


def transform_lead_to_alsagr_format(lead_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Transform lead service data to Alsagr portal format
    
    Args:
        lead_data: Lead data from lead service containing:
            - firstName, lastName, email
            - phone: {number, countryCode, isoCode}
            - lobData: {dateOfBirth, gender, maritalStatus, dependents}
    
    Returns:
        Dictionary formatted for Alsagr bot with primary and dependents
    """
    lob_data = lead_data.get('lobData', {})
    form_data = lead_data.get('formData', {})
    
    # #region agent log - Hypothesis A: Check input to adapter
    import json
    from datetime import datetime
    import os
    log_dir = os.environ.get('LOG_DIR', '/tmp')
    log_path = os.path.join(log_dir, 'alsagr_debug.log')
    try:
        with open(log_path, 'a') as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"initial","hypothesisId":"A","location":"adapter.py:91","message":"Adapter received lead","data":{"hasLobData":"lobData" in lead_data,"hasFormData":"formData" in lead_data,"formDataKeys":list(form_data.keys())[:5]},"timestamp":int(datetime.utcnow().timestamp()*1000)}) + '\n')
    except: pass
    # #endregion
    
    # Handle both nested (lobData) and flat structure
    # If lobData is empty, use top-level fields as fallback
    if not lob_data:
        lob_data = {
            'dateOfBirth': lead_data.get('dateOfBirth', ''),
            'gender': lead_data.get('gender', 'Male'),
            'maritalStatus': lead_data.get('maritalStatus', 'Single'),
            'dependents': lead_data.get('dependents', [])
        }
    
    # Map primary member - use lobData first, then fallback to top-level
    # Format phone: Portal expects "05XXXXXXXX" format (without country code)
    # Handle both string and object formats for phone
    phone_value = lead_data.get('phone', '')
    if isinstance(phone_value, dict):
        phone_raw = phone_value.get('number', '')
    elif isinstance(phone_value, str):
        phone_raw = phone_value
    else:
        phone_raw = ''
    phone_formatted = format_phone_for_portal(phone_raw)
    
    primary = {
        'firstName': lead_data.get('firstName') or form_data.get('firstName', ''),
        'lastName': lead_data.get('lastName') or form_data.get('lastName', ''),
        'dateOfBirth': lob_data.get('dateOfBirth') or lead_data.get('dateOfBirth', ''),
        'gender': map_gender(lob_data.get('gender') or lead_data.get('gender', 'Male')),
        'maritalStatus': map_marital_status(lob_data.get('maritalStatus') or lead_data.get('maritalStatus', 'Single')),
        'phone': phone_formatted,
        'email': lead_data.get('email') or form_data.get('email', '')
    }
    
    # Map dependents - check multiple locations in order of priority
    dependents = []
    
    # Priority 1: Check formData sections (new format from production UI) - MOST COMMON
    if form_data and isinstance(form_data, dict):
        for key, value in form_data.items():
            if key.startswith('section-') and isinstance(value, list) and len(value) > 0:
                # Found the members section with data
                for member in value:
                    if not isinstance(member, dict):
                        continue
                    # Get first and last name (handle both camelCase and snake_case)
                    first_name = member.get('firstName', '') or member.get('first_name', '')
                    last_name = member.get('lastName', '') or member.get('last_name', '')
                    
                    # Skip if no name provided
                    if not first_name and not last_name:
                        continue
                    
                    # Handle different field names: "relation" vs "relationship"
                    relationship = member.get('relation') or member.get('relationship', 'spouse')
                    
                    dependents.append({
                        'firstName': first_name,
                        'lastName': last_name,
                        'dateOfBirth': member.get('dateOfBirth', '') or member.get('dob', ''),
                        'relationshipCode': map_relationship(relationship),
                        'genderCode': map_gender(member.get('gender', 'Male')),
                        'maritalStatusCode': map_marital_status(member.get('maritalStatus', 'Single'))
                    })
                if dependents:
                    break  # Only process first matching section with data
    
    # Priority 1.5: Check top-level section-* keys (when formData doesn't exist but section keys are at root)
    if not dependents:
        for key, value in lead_data.items():
            if key.startswith('section-') and isinstance(value, list) and len(value) > 0:
                # Found the members section at top level
                for member in value:
                    first_name = member.get('firstName', '')
                    last_name = member.get('lastName', '')
                    relationship = member.get('relation') or member.get('relationship', 'Child')
                    
                    dependents.append({
                        'firstName': first_name,
                        'lastName': last_name,
                        'dateOfBirth': member.get('dateOfBirth', ''),
                        'relationshipCode': map_relationship(relationship),
                        'genderCode': map_gender(member.get('gender', 'Male')),
                        'maritalStatusCode': map_marital_status(member.get('maritalStatus', 'Single'))
                    })
                break
    
    # Priority 2: Check lobData.dependents (old format - for backward compatibility)
    if not dependents:
        old_format_deps = lob_data.get('dependents', [])
        if old_format_deps:
            for dep in old_format_deps:
                # Split name into first and last
                full_name = dep.get('name', '')
                name_parts = full_name.split(' ', 1)
                first_name = name_parts[0] if len(name_parts) > 0 else ''
                last_name = name_parts[1] if len(name_parts) > 1 else ''
                
                dependents.append({
                    'firstName': first_name,
                    'lastName': last_name,
                    'dateOfBirth': dep.get('dateOfBirth', ''),
                    'relationshipCode': map_relationship(dep.get('relationship', 'Child')),
                    'genderCode': map_gender(dep.get('gender', 'Male')),
                    'maritalStatusCode': map_marital_status(dep.get('maritalStatus', 'Single'))
                })
    
    # Priority 3: Check top-level dependents (flat structure fallback)
    if not dependents:
        top_level_deps = lead_data.get('dependents', [])
        if top_level_deps:
            for dep in top_level_deps:
                if isinstance(dep, dict):
                    # Handle both name string and firstName/lastName object
                    if 'name' in dep:
                        # Old format: {name: "John Doe", ...}
                        full_name = dep.get('name', '')
                        name_parts = full_name.split(' ', 1)
                        first_name = name_parts[0] if len(name_parts) > 0 else ''
                        last_name = name_parts[1] if len(name_parts) > 1 else ''
                    else:
                        # New format: {firstName: "John", lastName: "Doe", ...}
                        first_name = dep.get('firstName', '')
                        last_name = dep.get('lastName', '')
                    
                    dependents.append({
                        'firstName': first_name,
                        'lastName': last_name,
                        'dateOfBirth': dep.get('dateOfBirth', ''),
                        'relationshipCode': map_relationship(dep.get('relationship') or dep.get('relation', 'Child')),
                        'genderCode': map_gender(dep.get('gender', 'Male')),
                        'maritalStatusCode': map_marital_status(dep.get('maritalStatus', 'Single'))
                    })
    
    # #region agent log - Log what we extracted
    try:
        with open(log_path, 'a') as f:
            f.write(json.dumps({"sessionId":"debug-session","runId":"initial","hypothesisId":"A","location":"adapter.py:144","message":"Dependents extracted","data":{"dependentsCount":len(dependents),"dependents":dependents},"timestamp":int(datetime.utcnow().timestamp()*1000)}) + '\n')
    except: pass
    # #endregion
    
    # Map emirate from lead data (check all possible locations)
    # Priority: formData.visaEmirate > lobData.emirate > top-level emirate > formData.emirate
    emirate_code = '13'  # Default to Dubai
    emirate_name = None
    
    # Check all possible locations for emirate
    if form_data and form_data.get('visaEmirate'):
        # If visaEmirate is already a code (numeric string), use it directly
        visa_emirate = str(form_data.get('visaEmirate', '')).strip()
        if visa_emirate.isdigit():
            emirate_code = visa_emirate
        else:
            # If it's a name, map it
            emirate_name = visa_emirate
            emirate_code = map_emirate(visa_emirate)
    elif lob_data and lob_data.get('emirate'):
        emirate_name = lob_data.get('emirate')
        emirate_code = map_emirate(emirate_name)
    elif lead_data.get('emirate'):
        emirate_name = lead_data.get('emirate')
        emirate_code = map_emirate(emirate_name)
    elif form_data and form_data.get('emirate'):
        emirate_name = form_data.get('emirate')
        emirate_code = map_emirate(emirate_name)
    
    # Log the mapping for debugging
    if emirate_name:
        print(f"📋 Emirate mapping: '{emirate_name}' -> code '{emirate_code}'", file=sys.stderr)
    
    # Map salary band from lead data if available
    salary_band_code = '23'  # Default to 4k-12k range
    if lob_data and lob_data.get('salaryRange'):
        salary_band_code = map_salary_band(lob_data.get('salaryRange'))
    elif form_data and form_data.get('salaryBand'):
        # If already a code, use it directly
        if str(form_data.get('salaryBand')).isdigit():
            salary_band_code = str(form_data.get('salaryBand'))
        else:
            salary_band_code = map_salary_band(form_data.get('salaryBand'))
    
    # Map visa type from lead data if available
    # IMPORTANT: Visa type is only required for Abu Dhabi (11) and Al Ain (313)
    visa_type_code = '141'  # Default to Employee
    if form_data and form_data.get('visaType'):
        # If already a code, use it directly
        if str(form_data.get('visaType')).isdigit():
            visa_type_code = str(form_data.get('visaType'))
        else:
            visa_type_code = map_visa_type(form_data.get('visaType'))
    elif lob_data and lob_data.get('visaType'):
        visa_type_code = map_visa_type(lob_data.get('visaType'))
    
    return {
        'primary': primary,
        'dependents': dependents,
        # Portal required fields
        'visaEmirate': emirate_code,  # Use emirate code from lead data
        'emirate': emirate_name if emirate_name else None,  # Pass emirate name for fallback selection
        'lobData': lob_data,  # Pass lobData so bot can access emirate name
        'visaType': visa_type_code,  # Use mapped visa type (default: 141 = Employee)
        'salaryBand': salary_band_code  # Use mapped salary band (default: 23 = 4k-12k)
    }


def map_relationship(relationship: str) -> str:
    """
    Map relationship string to Alsagr portal code
    
    Based on Playwright recording - portal order (top to bottom):
    - 49 = Spouse (position 1)
    - 51 = Child (position 2)
    - 47 = Other (position 3)
    - 50 = Parent (position 4)
    - 48 = Principal (position 5)
    
    Args:
        relationship: Relationship type (case-insensitive: 'Spouse', 'spouse', 'Child', 'parent', 'Principal', etc.)
        
    Returns:
        Portal dropdown value code
    """
    # Normalize to title case for consistent mapping
    if not relationship:
        return '51'  # Default to Child
    
    rel = relationship.strip().title()
    
    mapping = {
        'Spouse': '49',
        'Child': '51',
        'Son': '51',
        'Daughter': '51',
        'Other': '47',
        'Parent': '50',
        'Father': '50',
        'Mother': '50',
        'Principal': '48'
    }
    return mapping.get(rel, '51')  # Default to Child


def map_gender(gender: str) -> str:
    """
    Map gender string to Alsagr portal code
    
    Based on recorded portal flow:
    - 190 = Male
    - 191 = Female
    
    Args:
        gender: Gender ('Male', 'Female', 'M', 'F')
        
    Returns:
        Portal dropdown value code
    """
    mapping = {
        'Male': '190',
        'male': '190',
        'M': '190',
        'm': '190',
        'Female': '191',
        'female': '191',
        'F': '191',
        'f': '191'
    }
    return mapping.get(gender, '190')  # Default to Male


def map_marital_status(status: str) -> str:
    """
    Map marital status string to Alsagr portal code
    
    Based on recorded portal flow:
    - 20 = Married
    - 21 = Single
    - 22 = Divorced (needs verification)
    - 23 = Widowed (needs verification)
    
    Args:
        status: Marital status ('Married', 'Single', 'Divorced', 'Widowed')
        
    Returns:
        Portal dropdown value code
    """
    mapping = {
        'Married': '20',
        'married': '20',
        'Single': '21',
        'single': '21',
        'Divorced': '22',  # TODO: Verify this value
        'divorced': '22',
        'Widowed': '23',   # TODO: Verify this value
        'widowed': '23'
    }
    return mapping.get(status, '21')  # Default to Single


def map_emirate(emirate: str) -> str:
    """
    Map emirate name to Alsagr portal code
    
    CORRECTED MAPPING (based on Playwright recording - exact codes from portal):
    Portal dropdown order and codes:
    1. Abu Dhabi = 11
    2. Ajman = 12
    3. Al Ain = 313 (NOTE: This is 313, not 13!)
    4. Dubai = 13
    5. Fujairah = 14
    6. Ras Al Khaimah = 17
    7. Sharjah = 18
    8. Umm Al Quwain = 19
    
    Args:
        emirate: Emirate name ('Abu Dhabi', 'Dubai', 'Sharjah', etc.)
        
    Returns:
        Portal dropdown value code
    """
    if not emirate:
        return '13'  # Default to Dubai
    
    # Normalize emirate name (case-insensitive, handle variations)
    emirate_lower = emirate.strip().lower()
    
    mapping = {
        # Position 1: Abu Dhabi = 11
        'abu dhabi': '11',
        'abudhabi': '11',
        'abu-dhabi': '11',
        'auh': '11',
        # Position 2: Ajman = 12
        'ajman': '12',
        'ajm': '12',
        # Position 3: Al Ain = 313 (NOTE: This is 313, not 12 or 13!)
        'al ain': '313',
        'alain': '313',
        'al-ain': '313',
        # Position 4: Dubai = 13
        'dubai': '13',
        'dxb': '13',
        # Position 5: Fujairah = 14
        'fujairah': '14',
        'fuj': '14',
        # Position 6: Ras Al Khaimah = 17
        'ras al khaimah': '17',
        'ras-al-khaimah': '17',
        'rak': '17',
        # Position 7: Sharjah = 18
        'sharjah': '18',
        'shj': '18',
        # Position 8: Umm Al Quwain = 19
        'umm al quwain': '19',
        'umm-al-quwain': '19',
        'uaq': '19'
    }
    
    return mapping.get(emirate_lower, '13')  # Default to Dubai if not found


def map_visa_type(visa_type: str = None) -> str:
    """
    Map visa type to Alsagr portal code
    
    IMPORTANT: Visa Type dropdown only appears for Abu Dhabi (11) and Al Ain (313) emirates.
    
    Based on Playwright recording - portal order (top to bottom):
    - 281 = Self Dependent (position 1)
    - 142 = Domestic Visa Holder (position 2)
    - 141 = Employee (position 3)
    - 143 = Investor (position 4)
    
    Args:
        visa_type: Visa type description ('Employee', 'Self Dependent', 'Domestic Visa Holder', 'Investor', etc.)
                  If None, returns default (141 = Employee)
        
    Returns:
        Portal dropdown value code
    """
    if not visa_type:
        return '141'  # Default to Employee
    
    # Normalize visa type (case-insensitive)
    visa_lower = visa_type.strip().lower()
    
    mapping = {
        'self dependent': '281',
        'self-dependent': '281',
        'selfdependent': '281',
        'domestic visa holder': '142',
        'domestic': '142',
        'employee': '141',
        'investor': '143'
    }
    
    # Try exact match first
    if visa_lower in mapping:
        return mapping[visa_lower]
    
    # Try partial matches
    if 'self' in visa_lower and 'dependent' in visa_lower:
        return '281'
    if 'domestic' in visa_lower:
        return '142'
    if 'employee' in visa_lower or 'employ' in visa_lower:
        return '141'
    if 'investor' in visa_lower or 'invest' in visa_lower:
        return '143'
    
    # Default to Employee
    return '141'


def map_salary_band(salary_range: str = None) -> str:
    """
    Map salary range to Alsagr portal code
    
    Based on Playwright recording - portal order: 23, 24, 22
    - 23 = 4,000 - 12,000 AED per month (4k to 12k) - DEFAULT
    - 24 = greater than 12,000 AED per month (>12k)
    - 22 = less than 4,000 AED per month (<4k)
    
    Args:
        salary_range: Salary range description ('4k-12k', '4k to 12k', '>12k', '<4k', etc.)
                      If None, returns default (23 = 4k-12k)
        
    Returns:
        Portal dropdown value code
    """
    if not salary_range:
        return '23'  # Default to 4k-12k range
    
    # Normalize salary range (case-insensitive)
    salary_lower = salary_range.strip().lower()
    
    # Check for >12k or greater than 12k
    if any(keyword in salary_lower for keyword in ['>12', 'greater than 12', 'more than 12', 'above 12', 'over 12']):
        return '24'
    
    # Check for <4k or less than 4k
    if any(keyword in salary_lower for keyword in ['<4', 'less than 4', 'below 4', 'under 4']):
        return '22'
    
    # Default to 4k-12k range
    return '23'


def validate_lead_data(lead_data: Dict[str, Any]) -> tuple[bool, List[str]]:
    """
    Validate lead data has required fields for Alsagr portal
    
    Args:
        lead_data: Lead data to validate
        
    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    
    # Check required primary member fields
    if not lead_data.get('firstName'):
        errors.append("Missing firstName")
    
    if not lead_data.get('lastName'):
        errors.append("Missing lastName")
    
    if not lead_data.get('email'):
        errors.append("Missing email")
    
    lob_data = lead_data.get('lobData', {})
    
    if not lob_data.get('dateOfBirth'):
        errors.append("Missing dateOfBirth in lobData")
    
    if not lob_data.get('gender'):
        errors.append("Missing gender in lobData")
    
    # Check phone structure
    # Handle both string and object formats for phone
    phone_value = lead_data.get('phone', '')
    if isinstance(phone_value, dict):
        phone = phone_value
    elif isinstance(phone_value, str):
        phone = {'number': phone_value}
    else:
        phone = {}
    if not phone.get('number'):
        errors.append("Missing phone number")
    
    # Validate dependents if present
    dependents = lob_data.get('dependents', [])
    for idx, dep in enumerate(dependents):
        if not dep.get('name'):
            errors.append(f"Dependent {idx + 1}: Missing name")
        if not dep.get('dateOfBirth'):
            errors.append(f"Dependent {idx + 1}: Missing dateOfBirth")
        if not dep.get('relationship'):
            errors.append(f"Dependent {idx + 1}: Missing relationship")
    
    return (len(errors) == 0, errors)
