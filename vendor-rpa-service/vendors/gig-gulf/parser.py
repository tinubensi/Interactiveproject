"""
GIG Gulf Plan Parser Module
Handles parsing of insurance plan data and converting to StandardPlan format
"""
import datetime
import uuid
import re
import json
from typing import Dict, Any, Optional, List


class GigGulfParser:
    """
    Parser class for GIG Gulf insurance plan data
    Extracts plan details and converts to StandardPlan format
    """
    
    def __init__(self):
        pass
    
    def clean_text(self, text: str) -> str:
        """
        Clean text by removing extra whitespace and special characters
        """
        if not text:
            return ""
        
        # Remove extra spaces/newlines
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
    
    def parse_plan_data(self, raw_data: Dict[str, Any], form_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parse raw plan data and convert to StandardPlan format
        
        Args:
            raw_data: Dictionary containing raw plan data from scraper
            form_data: Optional form data for context (leadId, etc.)
        
        Returns:
            Dictionary in StandardPlan format
        """
        # Initialize Default Structure
        plan_data = {
            "id": f"plan-{uuid.uuid4()}",
            "type": "plan",
            "leadId": form_data.get('leadId') if form_data else str(uuid.uuid4()),
            "vendorId": "vendor-gig-gulf",
            "fetchedAt": datetime.datetime.now().isoformat(),
            "vendorName": "GIG Gulf Insurance",
            "vendorCode": "GIG",
            "planName": "Unknown Plan",
            "planCode": "GIG-PLA-XX",
            "planType": "standard",
            "annualPremium": 0,
            "monthlyPremium": 0,
            "currency": "AED",
            "annualLimit": 0,
            "inpatientLimit": 0,
            "outpatientLimit": 0,
            "maternityLimit": 0,
            "emergencyLimit": 0,
            "pharmacyLimit": 0,
            "dentalLimit": 0,
            "opticalLimit": 0,
            "deductible": 0,
            "deductibleMetric": "AED",
            "coInsurance": 0,
            "coInsuranceMetric": "%",
            "copays": {},
            "waitingPeriod": 0,
            "waitingPeriodMetric": "days",
            "waitingPeriods": {
                "general": 0
            },
            "benefits": [],
            "exclusions": ["Subject to policy terms and conditions"],
            "lineOfBusiness": "medical",
            "lobSpecificData": {},
            "isAvailable": True,
            "isSelected": False,
            "isRecommended": False,
            "fetchRequestId": "",
            "source": "rpa",
            "rawPlanData": {
                "plan_name": None,
                "premium": None,
                "coverage_limit": None,
                "coverage_details": {}
            }
        }
        
        # Extract plan name
        if "plan_name" in raw_data and raw_data["plan_name"]:
            plan_name_raw = self.clean_text(raw_data["plan_name"])
            plan_data["planName"] = plan_name_raw
            plan_data["planCode"] = f"GIG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_name_raw)[:50]}"
            plan_data["rawPlanData"]["plan_name"] = plan_name_raw
        
        # Extract premium
        if "premium" in raw_data and raw_data["premium"]:
            try:
                annual_premium = float(raw_data["premium"])
                plan_data["annualPremium"] = annual_premium
                plan_data["monthlyPremium"] = round(annual_premium / 12, 2)
                plan_data["rawPlanData"]["premium"] = f"AED {annual_premium}"
            except:
                pass
        
        # Extract coverage limit
        if "coverage_limit" in raw_data and raw_data["coverage_limit"]:
            try:
                plan_data["annualLimit"] = float(raw_data["coverage_limit"])
                plan_data["rawPlanData"]["coverage_limit"] = str(raw_data["coverage_limit"])
            except:
                pass
        
        # Extract benefits
        if "benefits" in raw_data and raw_data["benefits"]:
            benefits_list = []
            
            for benefit_text in raw_data["benefits"]:
                benefit_text_clean = self.clean_text(benefit_text)
                
                if not benefit_text_clean or len(benefit_text_clean) < 3:
                    continue
                
                # Parse benefit to extract specific limits
                self._parse_benefit_text(benefit_text_clean, plan_data)
                
                # Add to benefits list
                benefits_list.append({
                    "name": benefit_text_clean,
                    "covered": True,
                    "description": benefit_text_clean
                })
            
            if benefits_list:
                plan_data["benefits"].append({
                    "categoryId": "coverage",
                    "categoryName": "Coverage Details",
                    "benefits": benefits_list
                })
        
        # Parse raw text if available
        if "raw_text" in raw_data and raw_data["raw_text"]:
            raw_text = raw_data["raw_text"]
            self._parse_raw_text(raw_text, plan_data)
        
        # Store raw data
        plan_data["rawPlanData"]["full_data"] = raw_data
        
        return plan_data
    
    def parse_plans_from_json(self, json_data: Any, form_data: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Parse plans from JSON data embedded in the page
        
        Args:
            json_data: JSON data (list or dict)
            form_data: Optional form data for context
        
        Returns:
            List of plans in StandardPlan format
        """
        plans = []
        
        try:
            if isinstance(json_data, list):
                # Process each plan in the list
                for index, plan_json in enumerate(json_data):
                    try:
                        plan = self._parse_single_json_plan(plan_json, form_data, index)
                        if plan:
                            plans.append(plan)
                    except Exception as e:
                        continue
            
            elif isinstance(json_data, dict):
                # Single plan object
                plan = self._parse_single_json_plan(json_data, form_data, 0)
                if plan:
                    plans.append(plan)
        
        except Exception as e:
            pass
        
        return plans
    
    def _parse_single_json_plan(self, plan_json: Dict[str, Any], form_data: Optional[Dict[str, Any]], index: int) -> Optional[Dict[str, Any]]:
        """
        Parse a single plan from JSON
        """
        # Initialize plan structure
        plan_data = {
            "id": f"plan-{uuid.uuid4()}",
            "type": "plan",
            "leadId": form_data.get('leadId') if form_data else str(uuid.uuid4()),
            "vendorId": "vendor-gig-gulf",
            "fetchedAt": datetime.datetime.now().isoformat(),
            "vendorName": "GIG Gulf Insurance",
            "vendorCode": "GIG",
            "planName": f"Plan {index + 1}",
            "planCode": f"GIG-PLA-{index + 1}",
            "planType": "standard",
            "annualPremium": 0,
            "monthlyPremium": 0,
            "currency": "AED",
            "annualLimit": 0,
            "benefits": [],
            "rawPlanData": {"source": "json", "original": plan_json}
        }
        
        # Try to extract common fields
        # (Adjust these based on actual JSON structure)
        field_mappings = {
            'name': ['name', 'planName', 'title', 'productName'],
            'premium': ['premium', 'price', 'annualPremium', 'totalPremium'],
            'coverage': ['coverage', 'coverageLimit', 'annualLimit', 'sumInsured'],
            'benefits': ['benefits', 'coverages', 'features']
        }
        
        # Extract plan name
        for field in field_mappings['name']:
            if field in plan_json and plan_json[field]:
                plan_data["planName"] = str(plan_json[field])
                plan_data["planCode"] = f"GIG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_data['planName'])[:50]}"
                break
        
        # Extract premium
        for field in field_mappings['premium']:
            if field in plan_json:
                try:
                    premium = float(str(plan_json[field]).replace(",", "").replace("AED", "").strip())
                    plan_data["annualPremium"] = premium
                    plan_data["monthlyPremium"] = round(premium / 12, 2)
                    break
                except:
                    pass
        
        # Extract coverage limit
        for field in field_mappings['coverage']:
            if field in plan_json:
                try:
                    limit = float(str(plan_json[field]).replace(",", "").replace("AED", "").strip())
                    plan_data["annualLimit"] = limit
                    break
                except:
                    pass
        
        # Extract benefits
        for field in field_mappings['benefits']:
            if field in plan_json and isinstance(plan_json[field], list):
                benefits_list = []
                for benefit in plan_json[field]:
                    if isinstance(benefit, str):
                        benefits_list.append({
                            "name": benefit,
                            "covered": True,
                            "description": benefit
                        })
                    elif isinstance(benefit, dict):
                        benefits_list.append({
                            "name": benefit.get('name', 'Unknown'),
                            "covered": benefit.get('covered', True),
                            "description": benefit.get('description', '')
                        })
                
                if benefits_list:
                    plan_data["benefits"].append({
                        "categoryId": "coverage",
                        "categoryName": "Coverage Details",
                        "benefits": benefits_list
                    })
                break
        
        return plan_data
    
    def _parse_benefit_text(self, benefit_text: str, plan_data: Dict[str, Any]):
        """
        Parse benefit text to extract specific coverage limits
        """
        benefit_lower = benefit_text.lower()
        
        # Extract numeric values
        numeric_match = re.search(r'([\d,]+\.?\d*)', benefit_text.replace(",", ""))
        numeric_value = float(numeric_match.group(1)) if numeric_match else 0
        
        # Map to specific fields
        if "annual limit" in benefit_lower or "coverage limit" in benefit_lower:
            if numeric_value > 0:
                plan_data["annualLimit"] = numeric_value
        
        elif "inpatient" in benefit_lower:
            if numeric_value > 0:
                plan_data["inpatientLimit"] = numeric_value
        
        elif "outpatient" in benefit_lower:
            if numeric_value > 0:
                plan_data["outpatientLimit"] = numeric_value
        
        elif "maternity" in benefit_lower:
            if numeric_value > 0:
                plan_data["maternityLimit"] = numeric_value
        
        elif "pharmacy" in benefit_lower or "medication" in benefit_lower:
            if numeric_value > 0:
                plan_data["pharmacyLimit"] = numeric_value
        
        elif "dental" in benefit_lower:
            if numeric_value > 0:
                plan_data["dentalLimit"] = numeric_value
        
        elif "optical" in benefit_lower or "vision" in benefit_lower:
            if numeric_value > 0:
                plan_data["opticalLimit"] = numeric_value
        
        elif "deductible" in benefit_lower:
            if numeric_value > 0:
                # Check if percentage or fixed amount
                if "%" in benefit_text:
                    plan_data["deductible"] = numeric_value
                    plan_data["deductibleMetric"] = "%"
                else:
                    plan_data["deductible"] = numeric_value
                    plan_data["deductibleMetric"] = "AED"
        
        elif "co-insurance" in benefit_lower or "coinsurance" in benefit_lower:
            percent_match = re.search(r'(\d+)%', benefit_text)
            if percent_match:
                plan_data["coInsurance"] = float(percent_match.group(1))
    
    def _parse_raw_text(self, raw_text: str, plan_data: Dict[str, Any]):
        """
        Parse raw text content to extract additional information
        """
        # Extract premium if not already set
        if plan_data["annualPremium"] == 0:
            premium_match = re.search(r'AED\s*([\d,]+\.?\d*)', raw_text)
            if premium_match:
                try:
                    premium = float(premium_match.group(1).replace(",", ""))
                    plan_data["annualPremium"] = premium
                    plan_data["monthlyPremium"] = round(premium / 12, 2)
                except:
                    pass
        
        # Extract waiting period
        waiting_match = re.search(r'(\d+)\s*(?:days?|months?)\s+waiting', raw_text, re.IGNORECASE)
        if waiting_match:
            try:
                value = int(waiting_match.group(1))
                if "month" in waiting_match.group(0).lower():
                    value = value * 30  # Convert months to days
                plan_data["waitingPeriod"] = value
                plan_data["waitingPeriods"]["general"] = value
            except:
                pass
