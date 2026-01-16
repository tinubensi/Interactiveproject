"""
Takaful Data Parser
Transforms raw extracted data into standardized JSON schema for StandardPlan model
"""
import re
from typing import Dict, List, Any, Tuple
from datetime import datetime
import uuid

# Metadata fields to exclude from benefits
METADATA_FIELDS = {
    'member name', 'member age', 'member gender', 'bmi', 'height', 'weight',
    'height/weight', 'emirate', 'quotation number', 'visa type', 'min premium', 
    'max premium', 'premium', 'price starting from', 'select plan', 'compare',
    'download network link', 'policy exclusion link', 'table of benifits',
    'table of benefits', 'policy wording', 'terms and conditions'
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
    'chronic': ['chronic', 'pre-existing', 'preexisting']
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
    'chronic': 'Chronic & Pre-existing Conditions',
    'other-coverage': 'Other Coverage Details'
}


class TakafulDataParser:
    """
    Parser for transforming Takaful plan data into StandardPlan format
    """
    
    def __init__(self):
        self.vendor_info = {
            "vendorId": "vendor-takaful",
            "vendorName": "Takaful Emarat"
        }
    
    def parse_plan(self, plan_data: Dict[str, Any], form_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Parse a single plan into StandardPlan format
        
        Args:
            plan_data: Raw plan data from scraper
            form_data: Optional form data for context
        
        Returns:
            Dictionary in StandardPlan format
        """
        plan_name = plan_data.get('plan_name', 'Unknown Plan')
        premium_str = plan_data.get('premium', '0')
        
        # Extract annual premium from premium string
        annual_premium = self._extract_premium(premium_str)
        
        # Generate plan code from name
        plan_code = self._generate_plan_code(plan_name)
        
        # Determine plan type based on premium
        plan_type = self._determine_plan_type(annual_premium)
        
        # Get coverage details
        coverage_details = plan_data.get('coverage_details', {})
        
        # Extract annual limit from coverage details
        annual_limit = self._extract_annual_limit(coverage_details)
        
        # Extract cost sharing details
        deductible = self._extract_deductible(coverage_details)
        coinsurance = self._extract_coinsurance(coverage_details)
        
        # Parse copay details using new method
        structured_copays, _ = self._parse_copay_details(coverage_details)
        
        # Get leadId from form_data if available
        lead_id = form_data.get('leadId', 'unknown') if form_data else 'unknown'
        
        # Extract optional sub-limits (UNIFIED STRUCTURE V2)
        inpatient_limit = self._extract_limit_from_details(coverage_details, ["inpatient", "in-patient"])
        outpatient_limit = self._extract_limit_from_details(coverage_details, ["outpatient", "out-patient"])
        maternity_limit = self._extract_limit_from_details(coverage_details, ["maternity", "pregnancy"])
        pharmacy_limit = self._extract_limit_from_details(coverage_details, ["pharmacy", "medicine", "medication"])
        dental_limit = self._extract_limit_from_details(coverage_details, ["dental", "teeth"])
        optical_limit = self._extract_limit_from_details(coverage_details, ["optical", "vision", "eye"])
        emergency_limit = self._extract_limit_from_details(coverage_details, ["emergency"])
        
        # Build StandardPlan formatted dictionary
        standard_plan = {
            "id": f"plan-{uuid.uuid4()}",
            "leadId": lead_id,
            "vendorId": self.vendor_info["vendorId"],
            "vendorName": self.vendor_info["vendorName"],
            "vendorCode": "TKF",  # Takaful vendor code
            
            # Basic Info
            "planName": plan_name,
            "planCode": plan_code,
            "planType": plan_type,
            
            # Pricing
            "annualPremium": float(annual_premium),
            "monthlyPremium": round(annual_premium / 12, 2) if annual_premium > 0 else 0.0,
            "currency": "AED",
            
            # Coverage Limits (required)
            "annualLimit": float(annual_limit),
            
            # Cost Sharing
            "deductible": float(deductible),
            "deductibleMetric": "AED",
            "coInsurance": float(coinsurance),
            "coInsuranceMetric": "%",
            "copays": structured_copays,
            
            # Waiting Periods
            "waitingPeriod": 30,
            "waitingPeriodMetric": "days",
            "waitingPeriods": {"general": 30},
            
            # Benefits - structured format using semantic categorization
            "benefits": self._categorize_benefits(coverage_details),
            
            # Exclusions
            "exclusions": ["Subject to policy terms and conditions"],
            
            # Metadata
            "lineOfBusiness": "medical",
            "lobSpecificData": {},
            "isAvailable": True,
            "isSelected": False,
            "isRecommended": False,
            "fetchRequestId": "",
            "fetchedAt": datetime.now().isoformat(),
            "source": "rpa",
            
            # Raw Data (for debugging/reference)
            "rawPlanData": plan_data
        }
        
        # Add optional sub-limits only if extracted (don't hardcode zeros)
        if inpatient_limit:
            standard_plan["inpatientLimit"] = float(inpatient_limit)
        if outpatient_limit:
            standard_plan["outpatientLimit"] = float(outpatient_limit)
        if maternity_limit:
            standard_plan["maternityLimit"] = float(maternity_limit)
        if emergency_limit:
            standard_plan["emergencyLimit"] = float(emergency_limit)
        if pharmacy_limit:
            standard_plan["pharmacyLimit"] = float(pharmacy_limit)
        if dental_limit:
            standard_plan["dentalLimit"] = float(dental_limit)
        if optical_limit:
            standard_plan["opticalLimit"] = float(optical_limit)
        
        # Create network object if TPA or network data available (UNIFIED STRUCTURE V2)
        tpa = plan_data.get("tpa")
        network_name = plan_data.get("network")
        if tpa or network_name:
            standard_plan["network"] = {
                "tpa": tpa,
                "networkName": network_name,
                "networkType": "standard"
            }
        
        return standard_plan
    
    def _extract_premium(self, premium_str: str) -> int:
        """Extract premium amount from premium string"""
        if not premium_str or premium_str == 'Contact for pricing':
            return 0
        
        # Match patterns like "AED 5,234 + VAT" or "AED 5234"
        match = re.search(r'AED\s*([\d,]+)', premium_str)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                return int(amount_str)
            except:
                pass
        return 0
    
    def _generate_plan_code(self, plan_name: str) -> str:
        """Generate plan code from plan name"""
        # Extract key parts from name like "BLUE 1" or "SILVER PREMIUM"
        parts = plan_name.split()
        code_parts = []
        
        for part in parts[:3]:  # Take first 3 meaningful parts
            if part and not part.startswith('('):
                code_parts.append(part[:3].upper())
        
        return f"TKF-{'-'.join(code_parts)}" if code_parts else f"TKF-{uuid.uuid4().hex[:8].upper()}"
    
    def _determine_plan_type(self, premium: int) -> str:
        """Determine plan type based on premium"""
        if premium >= 15000:
            return "platinum"
        elif premium >= 10000:
            return "gold"
        elif premium >= 5000:
            return "silver"
        else:
            return "bronze"
    
    def _extract_annual_limit(self, coverage_details: Dict[str, Any]) -> int:
        """Extract annual limit from coverage details"""
        # Look for "Annual limit" or "Annual Limit" key
        for key in ["Annual limit", "Annual Limit", "Limit"]:
            if key in coverage_details:
                limit_str = coverage_details[key]
                match = re.search(r'AED\s*([\d,]+)', str(limit_str))
                if match:
                    try:
                        return int(match.group(1).replace(',', ''))
                    except:
                        pass
        
        # Default based on premium if not found
        return 150000
    
    def _extract_deductible(self, coverage_details: Dict[str, Any]) -> int:
        """Extract deductible amount"""
        # Look for deductible in coverage details
        for key in ["Deductible", "deductible", "Excess"]:
            if key in coverage_details:
                ded_str = coverage_details[key]
                match = re.search(r'AED\s*([\d,]+)', str(ded_str))
                if match:
                    try:
                        return int(match.group(1).replace(',', ''))
                    except:
                        pass
        
        return 0  # Default no deductible
    
    def _extract_coinsurance(self, coverage_details: Dict[str, Any]) -> int:
        """Extract coinsurance percentage"""
        # Look for co-insurance in coverage details
        copay_str = coverage_details.get('Co-pay', '')
        if copay_str:
            match = re.search(r'(\d+)%', str(copay_str))
            if match:
                try:
                    return int(match.group(1))
                except:
                    pass
        
        return 0  # Default no coinsurance
    
    def _extract_copays(self, coverage_details: Dict[str, Any]) -> Dict[str, Any]:
        """Extract copay details for specific services"""
        copays = {}
        
        # Parse co-pay string if available
        copay_str = coverage_details.get('Co-pay', '')
        if copay_str:
            # Try to extract max amount
            max_match = re.search(r'max AED\s*(\d+)', str(copay_str))
            if max_match:
                copays["maxAmount"] = int(max_match.group(1))
        
        return copays
    
    def _extract_limit_from_details(self, coverage_details: Dict[str, Any], keywords: List[str]) -> int:
        """
        Extract sub-limit from coverage details based on keywords
        Returns 0 if not found (caller decides whether to include in plan)
        """
        for key, value in coverage_details.items():
            key_lower = key.lower()
            # Check if any keyword matches the key
            if any(kw in key_lower for kw in keywords):
                # Try to extract number from value
                value_str = str(value)
                match = re.search(r'AED\s*([\d,]+)', value_str)
                if match:
                    try:
                        return int(match.group(1).replace(',', ''))
                    except:
                        pass
                # Also try plain numbers
                match = re.search(r'(\d+[,\d]*)', value_str)
                if match:
                    try:
                        return int(match.group(1).replace(',', ''))
                    except:
                        pass
        return 0
    
    def _parse_copay_details(self, coverage_details: Dict[str, Any]) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Parse copay details from coverage_details, handling multi-line strings
        
        Returns:
            Tuple of (structured_copays_dict, benefit_entries_list)
        """
        structured_copays = {}
        benefit_entries = []
        
        # Look for co-pay related keys
        for key, value in coverage_details.items():
            key_lower = key.lower()
            
            if 'co-pay' in key_lower or 'copay' in key_lower:
                value_str = str(value)
                
                # Check if it's a multi-line copay field
                if '\n' in key or '\n' in value_str:
                    # Parse multi-line format like:
                    # Key: "Co-pay Consultation\nPharmacy\nDiagnostic"
                    # Value: "20% (max AED 25)\n20%\n20%"
                    
                    key_lines = key.split('\n')
                    value_lines = value_str.split('\n')
                    
                    # Extract service names from key
                    services = []
                    for line in key_lines:
                        line_clean = line.strip().lower().replace('co-pay', '').replace('copay', '').strip()
                        if line_clean and len(line_clean) > 2:
                            services.append(line_clean)
                    
                    # Extract copay values
                    copay_values = []
                    for line in value_lines:
                        line_clean = line.strip()
                        if line_clean and (('%' in line_clean) or ('aed' in line_clean.lower())):
                            copay_values.append(line_clean)
                    
                    # Match services to values
                    for i, service in enumerate(services):
                        if i < len(copay_values):
                            value_for_service = copay_values[i]
                        elif len(copay_values) == 1:
                            value_for_service = copay_values[0]
                        else:
                            value_for_service = "20%"  # Default
                        
                        # Add to structured copays
                        structured_copays[service] = value_for_service
                        
                        # Create benefit entry
                        benefit_entries.append({
                            'name': f"{service.capitalize()} Copay",
                            'covered': True,
                            'description': value_for_service,
                            'limit': value_for_service,
                            'category': 'outpatient'
                        })
                else:
                    # Simple copay field
                    # Extract max amount if present
                    max_match = re.search(r'max AED\s*(\d+)', value_str)
                    if max_match:
                        structured_copays["maxAmount"] = int(max_match.group(1))
                    
                    # Extract percentage
                    percent_match = re.search(r'(\d+)%', value_str)
                    if percent_match:
                        structured_copays["general"] = f"{percent_match.group(1)}%"
                        
                        benefit_entries.append({
                            'name': 'General Copay',
                            'covered': True,
                            'description': value_str,
                            'limit': value_str,
                            'category': 'outpatient'
                        })
        
        return structured_copays, benefit_entries
    
    def _categorize_benefits(self, coverage_details: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Categorize benefits semantically based on keywords
        
        Returns:
            List of benefit categories with categorized benefits
        """
        # Parse copays first
        structured_copays, copay_benefits = self._parse_copay_details(coverage_details)
        
        # Initialize categories dict
        categorized = {cat_id: [] for cat_id in CATEGORY_KEYWORDS.keys()}
        categorized['other-coverage'] = []
        
        # Add copay benefits to outpatient
        for copay_benefit in copay_benefits:
            categorized['outpatient'].append({
                'name': copay_benefit['name'],
                'covered': copay_benefit['covered'],
                'description': copay_benefit['description'],
                'limit': copay_benefit['limit']
            })
        
        # Process each coverage detail
        for key, value in coverage_details.items():
            key_lower = key.lower()
            value_str = str(value).strip()
            
            # Skip metadata fields
            if key_lower in METADATA_FIELDS:
                continue
            
            # Skip empty values
            if not value_str or value_str == 'N/A' or value_str == ':':
                continue
            
            # Skip if already processed as copay
            if 'co-pay' in key_lower or 'copay' in key_lower:
                continue
            
            # Skip TPA and Network (these are handled separately)
            if key_lower in ['tpa', 'network']:
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
            
            # Create benefit entry
            benefit_entry = {
                'name': key,
                'covered': True,
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
                    'description': 'Basic health coverage as per policy terms'
                }]
            }]
        
        return result
    
    def _format_benefits(self, coverage_details: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Format benefits as categorized structure"""
        # Create a basic benefit category from coverage details
        benefits = []
        
        # Extract key coverage items
        coverage_items = []
        for key, value in coverage_details.items():
            if key not in ["Premium", "TPA", "Network", "Co-pay", "Member Name", "Member Age", "Member Gender"]:
                if value and str(value).strip() and str(value) != "N/A":
                    coverage_items.append(f"{key}: {value}")
        
        if coverage_items:
            benefits.append({
                "categoryId": "coverage",
                "categoryName": "Coverage Details",
                "benefits": [
                    {
                        "name": item,
                        "covered": True,
                        "description": item
                    }
                    for item in coverage_items[:10]  # Limit to 10 items
                ]
            })
        
        # Add default if no benefits found
        if not benefits:
            benefits = [{
                "categoryId": "standard",
                "categoryName": "Standard Benefits",
                "benefits": [{
                    "name": "Basic Health Coverage",
                    "covered": True,
                    "description": "Basic health coverage as per policy terms"
                }]
            }]
        
        return benefits
