"""
Alsagr Portal Data Adapter
Transforms lead service data format to Alsagr portal-specific format
"""
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
        log_path = '/home/janees/Desktop/crm/.cursor/debug.log'
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
    log_path = '/home/janees/Desktop/crm/.cursor/debug.log'
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
    
    return {
        'primary': primary,
        'dependents': dependents,
        # Portal required fields
        'visaEmirate': '13',  # Default to Dubai
        'visaType': '2',      # Default to Employee (REQUIRED!)
        'salaryBand': '23'    # Default salary band
    }


def map_relationship(relationship: str) -> str:
    """
    Map relationship string to Alsagr portal code
    
    Based on recorded portal flow:
    - 48 = Spouse
    - 49 = Child
    - 50 = Parent
    
    Args:
        relationship: Relationship type (case-insensitive: 'Spouse', 'spouse', 'Child', 'parent', etc.)
        
    Returns:
        Portal dropdown value code
    """
    # Normalize to title case for consistent mapping
    if not relationship:
        return '49'  # Default to Child
    
    rel = relationship.strip().title()
    
    mapping = {
        'Spouse': '48',
        'Child': '49',
        'Son': '49',
        'Daughter': '49',
        'Parent': '50',
        'Father': '50',
        'Mother': '50'
    }
    return mapping.get(rel, '49')  # Default to Child


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
