"""
Watania Data Parser
Transforms raw extracted data into standardized JSON schema for FastAPI StandardPlan model
"""

import re
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid


class WataniaDataParser:
    """
    Parser for transforming Watania plan data into FastAPI StandardPlan format
    """
    
    def __init__(self):
        self.vendor_info = {
            "vendorId": "watania",
            "vendorName": "Watania Takaful"
        }
    
    def parse_plan_comprehensive(self, plan_data: Dict[str, Any], form_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Parse a plan with COMPREHENSIVE data for full comparison features
        
        Args:
            plan_data: Comprehensive raw plan data from scraper
            form_data: Optional form data for context
        
        Returns:
            Dictionary in StandardPlan format with ALL comparison data
        """
        plan_name = plan_data.get('sub_plan_name', 'Unknown Plan')
        
        # Get premium from comprehensive pricing data
        annual_premium = plan_data.get('annualPremium', 0)
        if not annual_premium:
            # Fallback to string parsing
            pricing_str = plan_data.get('pricing', '0')
            annual_premium = self._extract_premium(pricing_str)
        
        monthly_premium = plan_data.get('monthlyPremium', 0)
        if not monthly_premium and annual_premium > 0:
            monthly_premium = round(annual_premium / 12, 2)
        
        # Get coverage limits
        coverage_limits = plan_data.get('coverageLimits', {})
        annual_limit = coverage_limits.get('annualLimit', 0)
        if not annual_limit:
            annual_limit = self._extract_annual_limit(plan_data)
        
        # Get cost sharing (try multiple sources)
        cost_sharing = plan_data.get('costSharing', {})
        deductible = cost_sharing.get('deductible', 0)
        co_insurance = cost_sharing.get('coInsurance', 0)
        copays = cost_sharing.get('copays', {})
        
        # If not in cost sharing, check raw plan data from PDF
        if deductible == 0 and 'deductible' in plan_data:
            deductible = plan_data.get('deductible', 0)
        if co_insurance == 0 and 'coInsurance' in plan_data:
            co_insurance = plan_data.get('coInsurance', 0)
        
        # Get waiting periods
        waiting_periods = plan_data.get('waitingPeriods', {})
        general_waiting = waiting_periods.get('general', 30)
        
        # Get exclusions
        exclusions = plan_data.get('exclusions', [])
        if not exclusions:
            exclusions = self._extract_exclusions(plan_data.get('terms', ''))
        
        # Get benefits (use categories if available)
        benefits_categories = plan_data.get('benefitsCategories', [])
        if not benefits_categories:
            # Fallback to simple benefit list
            benefits_list = plan_data.get('benefits', [])
            # Also include coverage items as benefits
            coverage_items = plan_data.get('coverage', [])
            all_benefits = benefits_list + coverage_items
            benefits_categories = self._format_benefits_as_categories(all_benefits)
        
        # Ensure benefits have proper structure (not old format)
        if benefits_categories and len(benefits_categories) > 0:
            first_cat = benefits_categories[0]
            # Check if it's the old format with "items" instead of "benefits"
            if "items" in first_cat and "benefits" not in first_cat:
                # Convert old format to new format
                all_benefit_texts = []
                for cat in benefits_categories:
                    all_benefit_texts.extend(cat.get("items", []))
                benefits_categories = self._format_benefits_as_categories(all_benefit_texts)
        
        # Generate plan code
        plan_code = self._generate_plan_code(plan_name)
        
        # Determine plan type based on premium
        plan_type = self._determine_plan_type(annual_premium)
        
        # Get leadId from form_data
        lead_id = form_data.get('leadId', 'unknown') if form_data else 'unknown'
        
        # Build COMPREHENSIVE StandardPlan with ALL comparison data
        standard_plan = {
            "id": f"plan-{uuid.uuid4()}",
            "leadId": lead_id,
            "vendorId": self.vendor_info["vendorId"],
            "vendorName": self.vendor_info["vendorName"],
            "vendorCode": "WTN",
            
            # Basic Info
            "planName": plan_name,
            "planCode": plan_code,
            "planType": plan_type,
            
            # Pricing - Complete
            "annualPremium": float(annual_premium),
            "monthlyPremium": float(monthly_premium),
            "currency": "AED",
            
            # Coverage Limits - Complete
            "annualLimit": float(annual_limit),
            "inpatientLimit": float(coverage_limits.get('inpatientLimit', 0)),
            "outpatientLimit": float(coverage_limits.get('outpatientLimit', 0)),
            "maternityLimit": float(coverage_limits.get('maternityLimit', 0)),
            "emergencyLimit": float(coverage_limits.get('emergencyLimit', 0)),
            "pharmacyLimit": float(coverage_limits.get('pharmacyLimit', 0)),
            "dentalLimit": float(coverage_limits.get('dentalLimit', 0)),
            "opticalLimit": float(coverage_limits.get('opticalLimit', 0)),
            
            # Cost Sharing - Complete
            "deductible": float(deductible),
            "deductibleMetric": "AED",
            "coInsurance": float(co_insurance),
            "coInsuranceMetric": "%",
            "copays": copays,  # Dict with gpVisit, specialistVisit, emergency
            
            # Waiting Periods - Complete
            "waitingPeriod": general_waiting,
            "waitingPeriodMetric": "days",
            "waitingPeriods": waiting_periods,  # Dict with general, maternity, preexisting
            
            # Benefits - Detailed & Categorized
            "benefits": benefits_categories,
            
            # Exclusions - Complete
            "exclusions": exclusions[:10],  # Limit to 10
            
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
            "rawPlanData": {
                "sub_plan_name": plan_name,
                "pricing": plan_data.get('pricing', 'Not specified'),
                "benefits": plan_data.get('benefits', [])[:20],
                "coverage": plan_data.get('coverage', [])[:20],
                "terms": plan_data.get('terms', 'Not specified'),
                "coverageLimits": coverage_limits,
                "costSharing": cost_sharing
            }
        }
        
        return standard_plan
    
    def parse_plan(self, plan_data: Dict[str, Any], form_data: Dict[str, Any] = None) -> Dict[str, Any]:
        """
        Parse a single plan into FastAPI StandardPlan format
        
        Args:
            plan_data: Raw plan data from scraper
            form_data: Optional form data for context
        
        Returns:
            Dictionary in StandardPlan format
        """
        plan_name = plan_data.get('sub_plan_name', 'Unknown Plan')
        pricing_str = plan_data.get('pricing', '0')
        
        # Extract annual premium from pricing string
        annual_premium = self._extract_premium(pricing_str)
        
        # Generate plan code from name
        plan_code = self._generate_plan_code(plan_name)
        
        # Determine plan type based on premium
        plan_type = self._determine_plan_type(annual_premium)
        
        # Parse benefits into list of strings
        benefits_list = self._extract_benefits_list(
            plan_data.get('benefits', []),
            plan_data.get('coverage', [])
        )
        
        # Extract exclusions from terms
        exclusions = self._extract_exclusions(plan_data.get('terms', ''))
        
        # Get leadId from form_data if available
        lead_id = form_data.get('leadId', 'unknown') if form_data else 'unknown'
        
        # Build StandardPlan formatted dictionary matching quotation-generation-service Plan interface
        standard_plan = {
            "id": f"plan-{uuid.uuid4()}",
            "leadId": lead_id,
            "vendorId": self.vendor_info["vendorId"],
            "vendorName": self.vendor_info["vendorName"],
            "vendorCode": "WTN",  # Watania vendor code
            "planName": plan_name,
            "planCode": plan_code,
            "planType": plan_type,
            "annualPremium": float(annual_premium),
            "monthlyPremium": round(annual_premium / 12, 2) if annual_premium > 0 else 0.0,
            "currency": "AED",
            "annualLimit": float(self._extract_annual_limit(plan_data)),  # Renamed from coverageAmount
            "deductible": float(self._extract_deductible(plan_data)),
            "deductibleMetric": "AED",  # Currency metric for deductible
            "coInsurance": float(self._extract_coinsurance(plan_data)),
            "coInsuranceMetric": "%",  # Percentage metric for coinsurance
            "waitingPeriod": self._extract_waiting_period(plan_data),
            "waitingPeriodMetric": "days",  # Time metric for waiting period
            "benefits": self._format_benefits_as_categories(benefits_list),  # Convert to BenefitCategory format
            "exclusions": exclusions,
            "lineOfBusiness": "medical",  # Insurance line of business
            "lobSpecificData": {},  # LOB-specific data (empty for now)
            "isAvailable": True,  # Plan is available
            "isSelected": False,  # Not selected by default
            "isRecommended": False,  # Not recommended by default
            "fetchRequestId": "",  # Will be set by the system
            "fetchedAt": datetime.now().isoformat(),
            "source": "rpa",  # Sourced from RPA
            "rawPlanData": plan_data  # Renamed from rawData
        }
        
        return standard_plan
    
    def _extract_premium(self, pricing_str: str) -> int:
        """Extract premium amount from pricing string"""
        if not pricing_str or pricing_str == 'Not specified':
            return 0
        
        # Match patterns like "AED 75,000" or "75000"
        match = re.search(r'[\d,]+', pricing_str)
        if match:
            amount_str = match.group().replace(',', '')
            try:
                return int(amount_str)
            except:
                pass
        return 0
    
    def _generate_plan_code(self, plan_name: str) -> str:
        """Generate plan code from plan name"""
        # Extract key parts from name like "Class A NE1 (0-45) V4"
        parts = plan_name.split()
        code_parts = []
        
        for part in parts[:4]:  # Take first 4 meaningful parts
            if part and not part.startswith('('):
                code_parts.append(part[:3].upper())
        
        return f"WTN-{'-'.join(code_parts)}" if code_parts else f"WTN-{uuid.uuid4().hex[:8].upper()}"
    
    def _determine_plan_type(self, premium: int) -> str:
        """Determine plan type based on premium"""
        if premium >= 150000:
            return "platinum"
        elif premium >= 100000:
            return "gold"
        elif premium >= 50000:
            return "silver"
        else:
            return "bronze"
    
    def _extract_benefits_list(self, benefits: List[str], coverage: List[str]) -> List[str]:
        """Extract and clean benefits into a simple list of strings"""
        all_items = benefits + coverage
        cleaned_benefits = []
        
        for item in all_items:
            if item and len(item.strip()) > 10:
                # Clean the text
                cleaned = ' '.join(item.split())
                cleaned = cleaned.strip()
                
                # Skip duplicates
                if cleaned not in cleaned_benefits:
                    cleaned_benefits.append(cleaned)
        
        return cleaned_benefits[:30]  # Limit to 30 benefits
    
    def _format_benefits_as_categories(self, benefits_list: List[str]) -> List[Dict[str, Any]]:
        """
        Format benefits as BenefitCategory objects matching frontend structure
        
        Frontend expects:
        {
          categoryId: string,
          categoryName: string,
          benefits: BenefitDetail[]
        }
        
        BenefitDetail: {
          name: string,
          covered: boolean,
          limit?: number,
          limitMetric?: string,
          description?: string
        }
        
        Args:
            benefits_list: List of benefit strings
            
        Returns:
            List of benefit category dictionaries matching frontend structure
        """
        if not benefits_list:
            return [{
                "categoryId": "standard",
                "categoryName": "Standard Benefits",
                "benefits": [{
                    "name": "Basic Health Coverage",
                    "covered": True,
                    "description": "Basic health coverage as per policy terms"
                }]
            }]
        
        # Parse benefits and extract structured data
        parsed_benefits = []
        for benefit_text in benefits_list:
            parsed = self._parse_benefit_detail(benefit_text)
            if parsed:
                parsed_benefits.append(parsed)
        
        # Group by category
        categories = self._group_benefits_by_category(parsed_benefits)
        
        return categories
    
    def _parse_benefit_detail(self, benefit_text: str) -> Dict[str, Any]:
        """
        Parse a benefit text into BenefitDetail structure
        
        Examples:
        - "Hospital Room: AED 1,500 per night" → {name: "Hospital Room", limit: 1500, limitMetric: "AED"}
        - "ICU Coverage up to AED 3,000/day" → {name: "ICU Coverage", limit: 3000, limitMetric: "AED"}
        - "Maternity covered" → {name: "Maternity", covered: true}
        """
        benefit_detail = {
            "covered": True  # Assume covered if listed
        }
        
        # Extract name and limit
        # Pattern 1: "Name: AED 1,500 per unit"
        match = re.match(r'([^:]+):\s*AED\s*([\d,]+)\s*(?:per\s+)?(.+)?', benefit_text, re.IGNORECASE)
        if match:
            benefit_detail["name"] = match.group(1).strip()
            benefit_detail["limit"] = int(match.group(2).replace(',', ''))
            benefit_detail["limitMetric"] = "AED"
            if match.group(3):
                benefit_detail["description"] = benefit_text
            return benefit_detail
        
        # Pattern 2: "Name up to AED 1,500"
        match = re.match(r'(.+?)\s+up to\s+AED\s*([\d,]+)', benefit_text, re.IGNORECASE)
        if match:
            benefit_detail["name"] = match.group(1).strip()
            benefit_detail["limit"] = int(match.group(2).replace(',', ''))
            benefit_detail["limitMetric"] = "AED"
            benefit_detail["description"] = benefit_text
            return benefit_detail
        
        # Pattern 3: "Name AED 1,500"
        match = re.match(r'(.+?)\s+AED\s*([\d,]+)', benefit_text, re.IGNORECASE)
        if match:
            benefit_detail["name"] = match.group(1).strip()
            benefit_detail["limit"] = int(match.group(2).replace(',', ''))
            benefit_detail["limitMetric"] = "AED"
            benefit_detail["description"] = benefit_text
            return benefit_detail
        
        # Pattern 4: "Name (percentage)"
        match = re.match(r'(.+?)\s+(\d+)%', benefit_text)
        if match:
            benefit_detail["name"] = match.group(1).strip()
            benefit_detail["limit"] = int(match.group(2))
            benefit_detail["limitMetric"] = "percentage"
            benefit_detail["description"] = benefit_text
            return benefit_detail
        
        # Pattern 5: Just a name
        benefit_detail["name"] = benefit_text.strip()
        benefit_detail["description"] = benefit_text
        
        return benefit_detail
    
    def _group_benefits_by_category(self, parsed_benefits: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Group parsed benefits into categories based on keywords
        """
        categories = {
            "inpatient": {
                "categoryId": "inpatient",
                "categoryName": "Inpatient Care",
                "keywords": ["inpatient", "hospital", "icu", "surgery", "admission", "room", "ward"],
                "benefits": []
            },
            "outpatient": {
                "categoryId": "outpatient",
                "categoryName": "Outpatient Care",
                "keywords": ["outpatient", "clinic", "consultation", "gp", "specialist", "doctor visit"],
                "benefits": []
            },
            "maternity": {
                "categoryId": "maternity",
                "categoryName": "Maternity Coverage",
                "keywords": ["maternity", "pregnancy", "delivery", "prenatal", "postnatal", "childbirth"],
                "benefits": []
            },
            "emergency": {
                "categoryId": "emergency",
                "categoryName": "Emergency Services",
                "keywords": ["emergency", "accident", "ambulance", "urgent"],
                "benefits": []
            },
            "pharmacy": {
                "categoryId": "pharmacy",
                "categoryName": "Pharmacy & Medication",
                "keywords": ["pharmacy", "medication", "prescription", "drug", "medicine"],
                "benefits": []
            },
            "dental": {
                "categoryId": "dental",
                "categoryName": "Dental Coverage",
                "keywords": ["dental", "teeth", "orthodontic", "dentist"],
                "benefits": []
            },
            "optical": {
                "categoryId": "optical",
                "categoryName": "Optical Coverage",
                "keywords": ["optical", "vision", "eye", "glasses", "lenses", "eyewear"],
                "benefits": []
            },
            "other": {
                "categoryId": "other",
                "categoryName": "Other Benefits",
                "keywords": [],
                "benefits": []
            }
        }
        
        # Categorize each benefit
        for benefit in parsed_benefits:
            benefit_name_lower = benefit.get("name", "").lower()
            benefit_desc_lower = benefit.get("description", "").lower()
            
            categorized = False
            for cat_id, category in categories.items():
                if cat_id == "other":
                    continue
                
                # Check if benefit matches category keywords
                if any(kw in benefit_name_lower or kw in benefit_desc_lower for kw in category["keywords"]):
                    category["benefits"].append(benefit)
                    categorized = True
                    break
            
            # If not categorized, add to "other"
            if not categorized:
                categories["other"]["benefits"].append(benefit)
        
        # Return only categories with benefits
        result = []
        for cat_id in ["inpatient", "outpatient", "maternity", "emergency", "pharmacy", "dental", "optical", "other"]:
            if categories[cat_id]["benefits"]:
                result.append({
                    "categoryId": categories[cat_id]["categoryId"],
                    "categoryName": categories[cat_id]["categoryName"],
                    "benefits": categories[cat_id]["benefits"]
                })
        
        return result if result else [{
            "categoryId": "standard",
            "categoryName": "Standard Benefits",
            "benefits": [{
                "name": "Basic Health Coverage",
                "covered": True,
                "description": "Basic health coverage as per policy terms"
            }]
        }]
    
    def _extract_annual_limit(self, plan_data: Dict[str, Any]) -> int:
        """Extract annual limit from plan data"""
        # Look in coverage items
        for coverage_text in plan_data.get('coverage', []):
            if 'annual' in coverage_text.lower() or 'limit' in coverage_text.lower():
                match = re.search(r'(?:AED|aed)\s*(\d+[,\d]*)', coverage_text)
                if match:
                    try:
                        amount = int(match.group(1).replace(',', ''))
                        if amount > 10000:  # Reasonable annual limit
                            return amount
                    except:
                        pass
        
        # Default based on pricing
        premium = self._extract_premium(plan_data.get('pricing', '0'))
        if premium >= 150000:
            return 1000000
        elif premium >= 75000:
            return 600000
        else:
            return 300000
    
    def _extract_deductible(self, plan_data: Dict[str, Any]) -> int:
        """Extract deductible amount"""
        terms = plan_data.get('terms', '').lower()
        
        # Look for deductible mentions
        match = re.search(r'deductible[:\s]+(?:AED|aed)?\s*(\d+[,\d]*)', terms)
        if match:
            try:
                return int(match.group(1).replace(',', ''))
            except:
                pass
        
        return 0  # Default no deductible
    
    def _extract_coinsurance(self, plan_data: Dict[str, Any]) -> int:
        """Extract coinsurance percentage"""
        all_text = ' '.join(plan_data.get('benefits', []) + plan_data.get('coverage', []))
        
        # Look for coinsurance mentions
        match = re.search(r'coinsurance[:\s]+(\d+)%', all_text, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except:
                pass
        
        return 0  # Default no coinsurance
    
    def _extract_waiting_period(self, plan_data: Dict[str, Any]) -> int:
        """Extract waiting period in days"""
        terms = plan_data.get('terms', '')
        
        # Look for waiting period mentions
        match = re.search(r'waiting period[:\s]+(\d+)\s*days?', terms, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except:
                pass
        
        return 30  # Default 30 days
    
    def _extract_exclusions(self, terms: str) -> List[str]:
        """Extract exclusions from terms"""
        if not terms or terms == 'Not specified':
            return ["Pre-existing conditions may apply", "Subject to policy terms and conditions"]
        
        exclusions = []
        
        # Look for exclusion keywords
        exclusion_keywords = ['not covered', 'excluded', 'exclusion', 'not be covered']
        
        sentences = re.split(r'[.!?]', terms)
        for sentence in sentences:
            sentence_lower = sentence.lower().strip()
            if any(keyword in sentence_lower for keyword in exclusion_keywords):
                if len(sentence.strip()) > 10:
                    exclusions.append(sentence.strip()[:150])
        
        # Add some common exclusions if none found
        if not exclusions:
            exclusions = [
                "Pre-existing conditions subject to medical underwriting",
                "Subject to policy terms and conditions"
            ]
        
        return exclusions[:5]  # Limit to 5 exclusions


