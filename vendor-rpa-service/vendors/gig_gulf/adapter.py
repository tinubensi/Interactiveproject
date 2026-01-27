"""
GIG Gulf Insurance Adapter
Handles data transformation for GIG Gulf Insurance portal
"""
from typing import Dict, Any, List, Optional
from datetime import datetime
from vendors.base.vendor_adapter import VendorAdapter
from vendors.gig_gulf.field_mappings import (
    COVERAGE_FIELD_MAPPINGS,
    BENEFIT_CATEGORY_KEYWORDS,
    CATEGORY_NAMES,
)


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
    
    def _normalize_coverage_details(self, coverage_details: Dict[str, Any]) -> Dict[str, Any]:
        """
        Normalize coverage details by mapping vendor-specific field names to standard names.
        
        Args:
            coverage_details: Original coverage details with GIG Gulf field names
            
        Returns:
            Normalized coverage details with standard field names
        """
        normalized = {}
        
        for vendor_key, value in coverage_details.items():
            # Map to standard field name if mapping exists
            standard_key = COVERAGE_FIELD_MAPPINGS.get(vendor_key, vendor_key)
            normalized[standard_key] = value
        
        return normalized
    
    def _map_coverage_fields(self, field_name: str) -> str:
        """
        Map a single GIG Gulf field name to its standard equivalent.
        
        Args:
            field_name: GIG Gulf field name
            
        Returns:
            Standard field name
        """
        return COVERAGE_FIELD_MAPPINGS.get(field_name, field_name)
    
    def _categorize_benefits(self, coverage_details: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Categorize benefits semantically based on field names.
        
        Similar to Sukoon's categorization approach, groups benefits into
        semantic categories (outpatient, inpatient, maternity, etc.)
        Network information is extracted separately into a "network" category.
        
        Args:
            coverage_details: Coverage details dictionary (with GIG Gulf field names)
            
        Returns:
            List of benefit categories with categorized benefits
        """
        # Initialize categories dict
        categorized = {cat_id: [] for cat_id in BENEFIT_CATEGORY_KEYWORDS.keys()}
        
        # Extract network information separately
        inpatient_network = None
        outpatient_network = None
        
        # Process each coverage detail
        for vendor_key, value in coverage_details.items():
            # Extract network information
            if vendor_key == 'inpatientDirectBillingNetwork' and value:
                inpatient_network = str(value).strip()
            elif vendor_key == 'outpatientDirectBillingNetwork' and value:
                outpatient_network = str(value).strip()
            
            # Skip if value is empty or not a string
            if not value or not isinstance(value, str):
                continue
            
            # Skip if value indicates no benefit
            value_str = str(value).strip()
            if value_str in ['No Benefit', 'No benefit', 'N/A', 'X', '✘', 'x', '']:
                continue
            
            # Skip network fields - they'll be handled separately
            if vendor_key in ['inpatientDirectBillingNetwork', 'outpatientDirectBillingNetwork']:
                continue
            
            # Find which category this field belongs to
            matched_category = None
            for cat_id, keywords in BENEFIT_CATEGORY_KEYWORDS.items():
                if vendor_key in keywords:
                    matched_category = cat_id
                    break
            
            # If no match, put in other-coverage
            if matched_category is None:
                matched_category = 'other-coverage'
            
            # Get standard field name for display
            standard_field_name = self._map_coverage_fields(vendor_key)
            
            # Determine if covered (not "No Benefit", etc.)
            is_covered = value_str not in ['X', '✘', 'x', 'Not Covered', 'Nil']
            
            # Create benefit entry
            benefit_entry = {
                'name': standard_field_name,
                'value': value_str,
                'covered': is_covered,
                'description': value_str,
                'limit': value_str
            }
            
            categorized[matched_category].append(benefit_entry)
        
        # Build final structure - only include non-empty categories
        result = []
        
        # Add network category if network information exists
        if inpatient_network or outpatient_network:
            network_parts = []
            if outpatient_network:
                network_parts.append(f"OP@ {outpatient_network}")
            if inpatient_network:
                network_parts.append(f"IP@ {inpatient_network}")
            
            network_description = " / ".join(network_parts) if network_parts else "Network information not available"
            
            result.append({
                'categoryId': 'network',
                'categoryName': 'Network',
                'benefits': [{
                    'name': 'Network',
                    'description': network_description,
                    'covered': True,
                    'limit': network_description,
                    'benefitId': '1'
                }]
            })
        
        # Add other categories
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
                    'value': 'Basic health coverage as per policy terms',
                    'covered': True,
                    'description': 'Basic health coverage as per policy terms',
                    'limit': 'As per policy'
                }]
            }]
        
        return result
    
    def normalize_response(self, raw_vendor_data: Any, lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw GIG Gulf data into StandardPlan format with normalized field names.
        
        This method:
        1. Applies field mappings to transform vendor-specific field names to standard names
        2. Categorizes benefits into semantic categories
        3. Normalizes coverage_details to use standard field names
        4. Preserves raw vendor data in rawPlanData for reference
        """
        if not isinstance(raw_vendor_data, list):
            return []
        
        normalized_plans = []
        
        for plan in raw_vendor_data:
            try:
                # Create a copy to avoid modifying the original
                normalized_plan = plan.copy()
                
                # Preserve enriched details field (contains static benefits from enricher)
                # This field is added by benefits_enricher and should be preserved
                enriched_details = normalized_plan.get('details', {})
                
                # Get raw coverage details (with vendor-specific field names)
                raw_plan_data = normalized_plan.get('rawPlanData', {})
                original_coverage_details = raw_plan_data.get('coverage_details', {})
                
                # Normalize coverage details (map field names to standard names)
                normalized_coverage_details = self._normalize_coverage_details(original_coverage_details)
                
                # Categorize benefits (using original vendor field names for categorization)
                categorized_benefits = self._categorize_benefits(original_coverage_details)
                
                # Update the plan with normalized data
                normalized_plan['benefits'] = categorized_benefits
                
                # Preserve enriched details if they exist (static benefits from enricher)
                if enriched_details:
                    normalized_plan['details'] = enriched_details
                
                # Update rawPlanData with normalized coverage_details
                # Keep original in a separate key for reference
                if 'rawPlanData' not in normalized_plan:
                    normalized_plan['rawPlanData'] = {}
                
                normalized_plan['rawPlanData']['coverage_details'] = normalized_coverage_details
                normalized_plan['rawPlanData']['original_coverage_details'] = original_coverage_details
                
                normalized_plans.append(normalized_plan)
            
            except Exception as e:
                # Log error but continue processing other plans
                print(f"Error normalizing GIG Gulf plan: {e}")
                # Return original plan if normalization fails
                normalized_plans.append(plan)
                continue
        
        return normalized_plans
