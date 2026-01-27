"""
GIG Gulf Plan Parser Module
Handles parsing of insurance plan data and converting to StandardPlan format
"""
import datetime
import uuid
import re
import json
from typing import Dict, Any, Optional, List


class Gig_gulfParser:
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
            plan_name_raw = self.clean_text(str(raw_data["plan_name"]))
            if plan_name_raw and plan_name_raw.strip():
                plan_data["planName"] = plan_name_raw
                plan_data["planCode"] = f"GIG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_name_raw)[:50]}"
                plan_data["rawPlanData"]["plan_name"] = plan_name_raw
        elif "raw_text" in raw_data and raw_data["raw_text"]:
            # Try to extract plan name from raw_text if not directly provided
            raw_text = raw_data["raw_text"]
            # Look for plan name at the beginning of raw_text (usually first line)
            lines = raw_text.split('\n')
            if lines and len(lines[0].strip()) > 0:
                # Skip if it's just a quotation reference
                first_line = lines[0].strip()
                if not first_line.startswith("Quotation Ref") and len(first_line) > 3:
                    plan_name_raw = self.clean_text(first_line)
                    plan_data["planName"] = plan_name_raw
                    plan_data["planCode"] = f"GIG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_name_raw)[:50]}"
                    plan_data["rawPlanData"]["plan_name"] = plan_name_raw
        
        # Extract premium
        if "premium" in raw_data and raw_data["premium"]:
            try:
                premium_value = raw_data["premium"]
                # Handle string values with "AED" prefix or commas
                if isinstance(premium_value, str):
                    # Remove "AED", commas, and whitespace
                    premium_value = premium_value.replace("AED", "").replace(",", "").strip()
                annual_premium = float(premium_value)
                plan_data["annualPremium"] = annual_premium
                plan_data["monthlyPremium"] = round(annual_premium / 12, 2)
                plan_data["rawPlanData"]["premium"] = f"AED {annual_premium}"
            except Exception as e:
                # If direct extraction fails, try parsing from raw_text
                if "raw_text" in raw_data and raw_data["raw_text"]:
                    try:
                        premium_match = re.search(r'AED\s*([\d,]+\.?\d*)', raw_data["raw_text"])
                        if premium_match:
                            annual_premium = float(premium_match.group(1).replace(",", ""))
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
        Parse raw text content to extract all plan details
        """
        if not raw_text:
            return
        
        raw_text_lower = raw_text.lower()
        
        # Initialize coverage details if not exists
        if "coverage_details" not in plan_data["rawPlanData"]:
            plan_data["rawPlanData"]["coverage_details"] = {}
        
        coverage_details = plan_data["rawPlanData"]["coverage_details"]
        
        # Extract premium if not already set
        if plan_data["annualPremium"] == 0:
            # Try multiple patterns for premium
            premium_patterns = [
                r'AED\s*([\d,]+\.?\d*)',  # AED 14,355.0
                r'([\d,]+\.?\d*)\s*AED',  # 14,355.0 AED
                r'Yearly[^\d]*([\d,]+\.?\d*)',  # Yearly 14,355
                r'Premium[^\d]*([\d,]+\.?\d*)',  # Premium: 14,355
            ]
            for pattern in premium_patterns:
                premium_match = re.search(pattern, raw_text, re.IGNORECASE)
                if premium_match:
                    try:
                        premium = float(premium_match.group(1).replace(",", ""))
                        plan_data["annualPremium"] = premium
                        plan_data["monthlyPremium"] = round(premium / 12, 2)
                        plan_data["rawPlanData"]["premium"] = f"AED {premium}"
                        break
                    except:
                        continue
        
        # Extract plan name if not already set
        if plan_data["planName"] == "Unknown Plan" and raw_text:
            # First line is usually the plan name (skip quotation ref)
            lines = raw_text.split('\n')
            for line in lines[:3]:  # Check first 3 lines
                line = line.strip()
                if line and not line.startswith("Quotation Ref") and len(line) > 3:
                    # Check if it looks like a plan name (not a number, not "AED")
                    if not re.match(r'^[\d,\.\sAED]+$', line) and len(line) < 100:
                        plan_name_raw = self.clean_text(line)
                        plan_data["planName"] = plan_name_raw
                        plan_data["planCode"] = f"GIG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_name_raw)[:50]}"
                        plan_data["rawPlanData"]["plan_name"] = plan_name_raw
                        break
        
        # Extract annual limit/coverage
        if plan_data["annualLimit"] == 0:
            limit_patterns = [
                r'Yearly Maximum[^\d]*AED\s*([\d,]+)',  # Yearly Maximum AED 7,500,000
                r'Annual Limit[^\d]*AED\s*([\d,]+)',  # Annual Limit AED 7,500,000
                r'Coverage[^\d]*AED\s*([\d,]+)',  # Coverage AED 7,500,000
            ]
            for pattern in limit_patterns:
                limit_match = re.search(pattern, raw_text, re.IGNORECASE)
                if limit_match:
                    try:
                        limit = float(limit_match.group(1).replace(",", ""))
                        plan_data["annualLimit"] = limit
                        plan_data["rawPlanData"]["coverage_limit"] = str(limit)
                        break
                    except:
                        continue
        
        # Extract specific benefit limits from raw text
        benefit_patterns = {
            'maternity': r'Maternity[^\d]*AED\s*([\d,]+)',
            'dental': r'Dental[^\d]*AED\s*([\d,]+)',
            'optical': r'Optical[^\d]*AED\s*([\d,]+)',
            'pharmacy': r'Pharmacy[^\d]*AED\s*([\d,]+)',
        }
        
        for benefit_type, pattern in benefit_patterns.items():
            match = re.search(pattern, raw_text, re.IGNORECASE)
            if match:
                try:
                    value = float(match.group(1).replace(",", ""))
                    if benefit_type == 'maternity' and plan_data["maternityLimit"] == 0:
                        plan_data["maternityLimit"] = value
                    elif benefit_type == 'dental' and plan_data["dentalLimit"] == 0:
                        plan_data["dentalLimit"] = value
                    elif benefit_type == 'optical' and plan_data["opticalLimit"] == 0:
                        plan_data["opticalLimit"] = value
                    elif benefit_type == 'pharmacy' and plan_data["pharmacyLimit"] == 0:
                        plan_data["pharmacyLimit"] = value
                except:
                    pass
        
        # Extract deductible
        if plan_data["deductible"] == 0:
            deductible_patterns = [
                r'Deductible[^\d]*AED\s*([\d,]+)',
                r'Deductible[^\d]*(\d+)%',
            ]
            for pattern in deductible_patterns:
                match = re.search(pattern, raw_text, re.IGNORECASE)
                if match:
                    try:
                        value = float(match.group(1).replace(",", ""))
                        plan_data["deductible"] = value
                        if "%" in match.group(0):
                            plan_data["deductibleMetric"] = "%"
                        break
                    except:
                        continue
        
        # Extract co-insurance
        if plan_data["coInsurance"] == 0:
            coinsurance_match = re.search(r'co-insurance[^\d]*(\d+)%', raw_text, re.IGNORECASE)
            if coinsurance_match:
                try:
                    plan_data["coInsurance"] = float(coinsurance_match.group(1))
                except:
                    pass
        
        # Extract Area Of Cover
        area_match = re.search(r'Area Of Cover\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if area_match:
            coverage_details["areaOfCover"] = area_match.group(1).strip()
        
        # Extract Yearly Maximum (Annual Limit)
        yearly_max_match = re.search(r'Yearly Maximum\s*\n\s*AED\s*([\d,]+)', raw_text, re.IGNORECASE)
        if yearly_max_match:
            try:
                limit = float(yearly_max_match.group(1).replace(",", ""))
                plan_data["annualLimit"] = limit
                coverage_details["yearlyMaximum"] = f"AED {limit:,.0f}"
            except:
                pass
        
        # Extract Outside Area of Cover
        outside_area_match = re.search(r'Outside Area of Cover\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if outside_area_match:
            coverage_details["outsideAreaOfCover"] = outside_area_match.group(1).strip()
        
        # Extract In-Patient direct billing Network
        inpatient_network_match = re.search(r'In-Patient direct billing Network[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if inpatient_network_match:
            coverage_details["inpatientDirectBillingNetwork"] = inpatient_network_match.group(1).strip()
        
        # Extract Complementary Therapy (with variations)
        # Try "Complementary Therapy" first (actual format)
        complementary_match = re.search(r'Complementary Therapy[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if not complementary_match:
            # Fallback to "Complementary and Alternative Therapy"
            complementary_match = re.search(r'Complementary and Alternative Therapy[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if complementary_match:
            coverage_details["complementaryTherapy"] = complementary_match.group(1).strip()
        
        # Extract Homeopathy and Ayurvedic treatment
        homeopathy_match = re.search(r'Homeopathy and Ayurvedic treatment[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if homeopathy_match:
            coverage_details["homeopathyAyurvedicTreatment"] = homeopathy_match.group(1).strip()
        
        # Extract Per visit deductible/co-insurance
        per_visit_match = re.search(r'Per visit (?:deductible|co-insurance)[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if per_visit_match:
            per_visit_text = per_visit_match.group(1).strip()
            coverage_details["perVisitDeductible"] = per_visit_text
            
            # Extract deductible amount if present
            deductible_amount_match = re.search(r'AED\s*([\d,]+)', per_visit_text)
            if deductible_amount_match:
                try:
                    deductible = float(deductible_amount_match.group(1).replace(",", ""))
                    if plan_data["deductible"] == 0:
                        plan_data["deductible"] = deductible
                        plan_data["deductibleMetric"] = "AED"
                except:
                    pass
        
        # Extract Out-patient direct billing network
        outpatient_network_match = re.search(r'Applicable Out-patient direct billing network\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if outpatient_network_match:
            coverage_details["outpatientDirectBillingNetwork"] = outpatient_network_match.group(1).strip()
        
        # Extract Health Screen
        health_screen_match = re.search(r'Health Screen\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if health_screen_match:
            health_screen_text = health_screen_match.group(1).strip()
            coverage_details["healthScreen"] = health_screen_text
            
            # Extract amount if present
            health_screen_amount_match = re.search(r'AED\s*([\d,]+)', health_screen_text)
            if health_screen_amount_match:
                try:
                    amount = float(health_screen_amount_match.group(1).replace(",", ""))
                    coverage_details["healthScreenAmount"] = amount
                except:
                    pass
        
        # Extract Pre-existing conditions - Within UAE/Abu Dhabi
        preexisting_within_match = re.search(r'Pre-existing conditions[^\n]*Within (?:UAE|Abu Dhabi)[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if preexisting_within_match:
            coverage_details["preexistingConditionsWithinUAE"] = preexisting_within_match.group(1).strip()
            
            # Extract amount
            amount_match = re.search(r'AED\s*([\d,]+)', preexisting_within_match.group(1))
            if amount_match:
                try:
                    amount = float(amount_match.group(1).replace(",", ""))
                    coverage_details["preexistingConditionsWithinUAEAmount"] = amount
                except:
                    pass
        
        # Extract Pre-existing conditions - Outside UAE/Abu Dhabi
        preexisting_outside_match = re.search(r'Pre-existing conditions[^\n]*Outside (?:UAE|Abu Dhabi)[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if preexisting_outside_match:
            coverage_details["preexistingConditionsOutsideUAE"] = preexisting_outside_match.group(1).strip()
            
            # Extract amount
            amount_match = re.search(r'AED\s*([\d,]+)', preexisting_outside_match.group(1))
            if amount_match:
                try:
                    amount = float(amount_match.group(1).replace(",", ""))
                    coverage_details["preexistingConditionsOutsideUAEAmount"] = amount
                except:
                    pass
        
        # Extract Optical
        optical_match = re.search(r'Optical\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if optical_match:
            optical_text = optical_match.group(1).strip()
            coverage_details["optical"] = optical_text
            
            # Extract amount if present
            optical_amount_match = re.search(r'AED\s*([\d,]+)', optical_text)
            if optical_amount_match:
                try:
                    amount = float(optical_amount_match.group(1).replace(",", ""))
                    plan_data["opticalLimit"] = amount
                except:
                    pass
            
            # Extract co-insurance percentage
            optical_coins_match = re.search(r'(\d+)%\s*co-insurance', optical_text, re.IGNORECASE)
            if optical_coins_match:
                try:
                    coins = float(optical_coins_match.group(1))
                    coverage_details["opticalCoInsurance"] = coins
                except:
                    pass
        
        # Extract Psychiatric Treatment
        psychiatric_match = re.search(r'Psychiatric treatment[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if psychiatric_match:
            psychiatric_text = psychiatric_match.group(1).strip()
            coverage_details["psychiatricTreatment"] = psychiatric_text
            
            # Extract amount if present
            psychiatric_amount_match = re.search(r'AED\s*([\d,]+)', psychiatric_text)
            if psychiatric_amount_match:
                try:
                    amount = float(psychiatric_amount_match.group(1).replace(",", ""))
                    coverage_details["psychiatricTreatmentAmount"] = amount
                except:
                    pass
        
        # Extract Maternity out-patient
        maternity_outpatient_match = re.search(r'Maternity out-patient\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if maternity_outpatient_match:
            coverage_details["maternityOutpatient"] = maternity_outpatient_match.group(1).strip()
        
        # Extract Normal Pregnancy, Childbirth (Delivery) and medically necessary Caesarean section
        pregnancy_match = re.search(r'Normal Pregnancy, Childbirth \(Delivery\) and medically necessary Caesarean section[^\n]*\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if pregnancy_match:
            pregnancy_text = pregnancy_match.group(1).strip()
            coverage_details["normalPregnancyChildbirth"] = pregnancy_text
            
            # Extract amount if present
            pregnancy_amount_match = re.search(r'AED\s*([\d,]+)', pregnancy_text)
            if pregnancy_amount_match:
                try:
                    amount = float(pregnancy_amount_match.group(1).replace(",", ""))
                    plan_data["maternityLimit"] = amount
                except:
                    pass
        
        # Extract Routine dental care
        dental_match = re.search(r'Routine dental care\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if dental_match:
            dental_text = dental_match.group(1).strip()
            coverage_details["routineDentalCare"] = dental_text
            
            # Extract amount if present
            dental_amount_match = re.search(r'AED\s*([\d,]+)', dental_text)
            if dental_amount_match:
                try:
                    amount = float(dental_amount_match.group(1).replace(",", ""))
                    plan_data["dentalLimit"] = amount
                except:
                    pass
        
        # Extract Ancillary equipment
        ancillary_match = re.search(r'Ancillary equipment\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if ancillary_match:
            ancillary_text = ancillary_match.group(1).strip()
            coverage_details["ancillaryEquipment"] = ancillary_text
            
            # Extract amount if present
            ancillary_amount_match = re.search(r'AED\s*([\d,]+)', ancillary_text)
            if ancillary_amount_match:
                try:
                    amount = float(ancillary_amount_match.group(1).replace(",", ""))
                    coverage_details["ancillaryEquipmentAmount"] = amount
                except:
                    pass
        
        # Extract Personal accident
        personal_accident_match = re.search(r'Personal accident\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if personal_accident_match:
            personal_accident_text = personal_accident_match.group(1).strip()
            coverage_details["personalAccident"] = personal_accident_text
            
            # Extract amount if present
            personal_accident_amount_match = re.search(r'AED\s*([\d,]+)', personal_accident_text)
            if personal_accident_amount_match:
                try:
                    amount = float(personal_accident_amount_match.group(1).replace(",", ""))
                    coverage_details["personalAccidentAmount"] = amount
                except:
                    pass
        
        # Extract Tele-consultation
        teleconsultation_match = re.search(r'Tele-consultation\s*\n\s*([^\n]+)', raw_text, re.IGNORECASE)
        if teleconsultation_match:
            coverage_details["teleConsultation"] = teleconsultation_match.group(1).strip()
        
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
        
        # Extract co-insurance percentage from various fields
        coinsurance_match = re.search(r'(\d+)%\s*co-insurance', raw_text, re.IGNORECASE)
        if coinsurance_match and plan_data["coInsurance"] == 0:
            try:
                plan_data["coInsurance"] = float(coinsurance_match.group(1))
            except:
                pass
        
        # Line-by-line parsing as fallback to catch any missed fields
        lines = raw_text.split('\n')
        lines = [line.strip() for line in lines if line.strip()]
        
        i = 0
        while i < len(lines):
            line = lines[i]
            line_lower = line.lower()
            
            # Complementary Therapy (if not already extracted)
            if "complementary therapy" in line_lower and "complementaryTherapy" not in coverage_details:
                if i + 1 < len(lines):
                    coverage_details["complementaryTherapy"] = lines[i + 1]
                    # Also extract amount if present
                    amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                    if amount_match:
                        try:
                            coverage_details["complementaryTherapyAmount"] = float(amount_match.group(1).replace(',', ''))
                        except:
                            pass
                    i += 2
                    continue
            
            # Check for any other fields that might have been missed
            # Area Of Cover
            if line_lower == "area of cover" and "areaOfCover" not in coverage_details and i + 1 < len(lines):
                coverage_details["areaOfCover"] = lines[i + 1]
                i += 2
                continue
            
            # Yearly Maximum
            if line_lower == "yearly maximum" and "yearlyMaximum" not in coverage_details and i + 1 < len(lines):
                next_line = lines[i + 1]
                coverage_details["yearlyMaximum"] = next_line
                amount_match = re.search(r'([\d,]+)', next_line.replace(',', ''))
                if amount_match:
                    try:
                        limit = float(amount_match.group(1))
                        if plan_data.get("annualLimit", 0) == 0:
                            plan_data["annualLimit"] = limit
                    except:
                        pass
                i += 2
                continue
            
            # Outside Area of Cover
            if line_lower == "outside area of cover" and "outsideAreaOfCover" not in coverage_details and i + 1 < len(lines):
                coverage_details["outsideAreaOfCover"] = lines[i + 1]
                i += 2
                continue
            
            # In-Patient direct billing Network
            if "in-patient direct billing" in line_lower and "inpatientDirectBillingNetwork" not in coverage_details and i + 1 < len(lines):
                coverage_details["inpatientDirectBillingNetwork"] = lines[i + 1]
                i += 2
                continue
            
            # Out-patient direct billing network
            if "out-patient direct billing" in line_lower and "outpatientDirectBillingNetwork" not in coverage_details and i + 1 < len(lines):
                coverage_details["outpatientDirectBillingNetwork"] = lines[i + 1]
                i += 2
                continue
            
            # Health Screen
            if line_lower == "health screen" and "healthScreen" not in coverage_details and i + 1 < len(lines):
                coverage_details["healthScreen"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        coverage_details["healthScreenAmount"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Pre-existing conditions - Within
            if "pre-existing conditions" in line_lower and "within" in line_lower and "preexistingConditionsWithinUAE" not in coverage_details and i + 1 < len(lines):
                coverage_details["preexistingConditionsWithinUAE"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        coverage_details["preexistingConditionsWithinUAEAmount"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Pre-existing conditions - Outside
            if "pre-existing conditions" in line_lower and "outside" in line_lower and "preexistingConditionsOutsideUAE" not in coverage_details and i + 1 < len(lines):
                coverage_details["preexistingConditionsOutsideUAE"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        coverage_details["preexistingConditionsOutsideUAEAmount"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Optical
            if line_lower == "optical" and "optical" not in coverage_details and i + 1 < len(lines):
                coverage_details["optical"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        if plan_data.get("opticalLimit", 0) == 0:
                            plan_data["opticalLimit"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Psychiatric Treatment
            if "psychiatric treatment" in line_lower and "psychiatricTreatment" not in coverage_details and i + 1 < len(lines):
                coverage_details["psychiatricTreatment"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        coverage_details["psychiatricTreatmentAmount"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Maternity out-patient
            if line_lower == "maternity out-patient" and "maternityOutpatient" not in coverage_details and i + 1 < len(lines):
                coverage_details["maternityOutpatient"] = lines[i + 1]
                i += 2
                continue
            
            # Normal Pregnancy, Childbirth
            if "normal pregnancy" in line_lower and "childbirth" in line_lower and "normalPregnancyChildbirth" not in coverage_details and i + 1 < len(lines):
                coverage_details["normalPregnancyChildbirth"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        if plan_data.get("maternityLimit", 0) == 0:
                            plan_data["maternityLimit"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Routine dental care
            if line_lower == "routine dental care" and "routineDentalCare" not in coverage_details and i + 1 < len(lines):
                coverage_details["routineDentalCare"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        if plan_data.get("dentalLimit", 0) == 0:
                            plan_data["dentalLimit"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Ancillary equipment
            if line_lower == "ancillary equipment" and "ancillaryEquipment" not in coverage_details and i + 1 < len(lines):
                coverage_details["ancillaryEquipment"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        coverage_details["ancillaryEquipmentAmount"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Personal accident
            if line_lower == "personal accident" and "personalAccident" not in coverage_details and i + 1 < len(lines):
                coverage_details["personalAccident"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        coverage_details["personalAccidentAmount"] = float(amount_match.group(1).replace(',', ''))
                    except:
                        pass
                i += 2
                continue
            
            # Tele-consultation
            if line_lower == "tele-consultation" and "teleConsultation" not in coverage_details and i + 1 < len(lines):
                coverage_details["teleConsultation"] = lines[i + 1]
                i += 2
                continue
            
            # Per visit deductible/co-insurance
            if "per visit" in line_lower and ("deductible" in line_lower or "co-insurance" in line_lower) and "perVisitDeductible" not in coverage_details and i + 1 < len(lines):
                coverage_details["perVisitDeductible"] = lines[i + 1]
                amount_match = re.search(r'AED\s*([\d,]+)', lines[i + 1])
                if amount_match:
                    try:
                        deductible = float(amount_match.group(1).replace(',', ''))
                        if plan_data.get("deductible", 0) == 0:
                            plan_data["deductible"] = deductible
                            plan_data["deductibleMetric"] = "AED"
                    except:
                        pass
                i += 2
                continue
            
            # Homeopathy and Ayurvedic treatment
            if ("homeopathy" in line_lower and "ayurvedic" in line_lower) and "homeopathyAyurvedicTreatment" not in coverage_details and i + 1 < len(lines):
                coverage_details["homeopathyAyurvedicTreatment"] = lines[i + 1]
                i += 2
                continue
            
            i += 1
        
        # Build benefits array from coverage details
        benefits_list = []
        for key, value in coverage_details.items():
            if value and value != "No Benefit" and value != "No benefit":
                if isinstance(value, str):
                    benefits_list.append({
                        "name": key,
                        "value": value,
                        "covered": True
                    })
        
        if benefits_list:
            plan_data["benefits"] = [{
                "categoryId": "coverage",
                "categoryName": "Coverage Details",
                "benefits": benefits_list
            }]