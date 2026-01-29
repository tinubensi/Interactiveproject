"""
Alsagr Plan Parser Module
Handles parsing of insurance plan PDFs and converting to StandardPlan format
"""
import pdfplumber
import datetime
import uuid
import re
import json
from typing import Dict, Any, Optional


class AlsagrParser:
    """
    Parser class for Alsagr insurance plan PDFs
    Extracts plan details and converts to StandardPlan format
    """
    
    def __init__(self):
        pass
    
    def clean_text(self, text: str) -> str:
        """
        Removes Arabic characters, replacement characters, and extra whitespace.
        Enhanced to fix PDF extraction artifacts.
        """
        if not text:
            return ""
        
        # Remove Unicode replacement character (this is the main culprit)
        text = text.replace('\ufffd', '')
        text = text.replace('�', '')
        
        # Remove Arabic characters (Unicode ranges)
        text = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', '', text)
        
        # Remove other non-printable characters and control characters
        text = re.sub(r'[\x00-\x1F\x7F-\x9F]+', ' ', text)
        
        # Remove common PDF extraction artifacts
        text = re.sub(r'\.+\s*\.', '.', text)  # Multiple dots like ". .\ufffd ."
        text = re.sub(r'\s+\.', '.', text)  # Space before dot
        text = re.sub(r'\.\s+\.', '. ', text)  # Dots with spaces
        
        # Remove extra spaces/newlines
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Clean up sentence-ending punctuation artifacts
        text = re.sub(r'\.+$', '.', text)  # Multiple trailing dots
        text = re.sub(r'^\.\s*', '', text)  # Leading dots
        
        return text
    
    def parse_plan(self, pdf_path: str, html_data: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parses the insurance plan PDF and extracts data into the StandardPlan structure.
        
        Args:
            pdf_path: Path to the PDF file
            html_data: Optional dict containing pre-scraped HTML/modal data
            form_data: Optional form data for context (leadId, etc.)
        
        Returns:
            Dictionary in StandardPlan format
        """
        import os
        
        # Validate PDF file exists and is readable
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        if os.path.getsize(pdf_path) == 0:
            raise ValueError(f"PDF file is empty: {pdf_path}")
        
        # Initialize Default Structure
        # Get leadId from form_data (vendor_payload should include leadId)
        lead_id = None
        if form_data:
            lead_id = form_data.get('leadId') or form_data.get('id') or form_data.get('lead_id')
        
        plan_data = {
            "id": f"plan-{uuid.uuid4()}",
            "type": "plan",
            "leadId": lead_id if lead_id else str(uuid.uuid4()),
            "vendorId": "vendor-alsagr",
            "fetchedAt": datetime.datetime.now().isoformat(),
            "vendorName": "Alsagr Insurance",
            "vendorCode": "ASG",
            "planName": "Unknown Plan",
            "planCode": "ASG-PLA-XX",
            "planType": "gold",
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
                "plan_number": None,
                "plan_name": None,
                "premium": None,
                "network": None,
                "tpa": None,
                "copay": "N/A",
                "coverage_details": {}
            }
        }

        # --- MERGE HTML/MODAL DATA FIRST (Priority: Modal > HTML > PDF) ---
        if html_data:
            # Store plan_number and raw premium text from HTML
            if "plan_number" in html_data and html_data["plan_number"]:
                plan_data["rawPlanData"]["plan_number"] = html_data["plan_number"]
            
            if "html_premium_raw" in html_data and html_data["html_premium_raw"]:
                plan_data["rawPlanData"]["premium"] = html_data["html_premium_raw"]
            
            # First, check for modal data (highest priority)
            if "modal_data" in html_data and html_data["modal_data"]:
                modal_data = html_data["modal_data"]
                
                # Annual Limit from modal
                if "annual_limit" in modal_data:
                    try:
                        plan_data["annualLimit"] = float(modal_data["annual_limit"])
                    except: pass
                
                # Deductible from modal
                if "deductible" in modal_data:
                    try:
                        plan_data["deductible"] = float(modal_data["deductible"])
                    except: pass
                
                # Pharmacy Limit from modal
                if "pharmacy_limit" in modal_data:
                    try:
                        plan_data["pharmacyLimit"] = float(modal_data["pharmacy_limit"])
                    except: pass
                
                # Dental Limit from modal
                if "dental_limit" in modal_data:
                    try:
                        plan_data["dentalLimit"] = float(modal_data["dental_limit"])
                    except: pass
                
                # Optical Limit from modal
                if "optical_limit" in modal_data:
                    try:
                        plan_data["opticalLimit"] = float(modal_data["optical_limit"])
                    except: pass
                
                # Maternity Limit from modal
                if "maternity_limit" in modal_data:
                    try:
                        plan_data["maternityLimit"] = float(modal_data["maternity_limit"])
                    except: pass
                
                # Co-insurance percentage from modal
                if "coinsurance_percent" in modal_data:
                    try:
                        plan_data["coInsurance"] = float(modal_data["coinsurance_percent"])
                    except: pass
                
                # Copays from modal
                if "copays" in modal_data:
                    copays_dict = {}
                    modal_copays = modal_data["copays"]
                    
                    if "op_copay" in modal_copays:
                        copays_dict["opCopay"] = f"{modal_copays['op_copay']}%"
                    
                    if "op_consultation_percent" in modal_copays:
                        copays_dict["opConsultation"] = f"{modal_copays['op_consultation_percent']}%"
                        if "op_consultation_max_aed" in modal_copays:
                            copays_dict["opConsultationMaxAED"] = float(modal_copays["op_consultation_max_aed"])
                    
                    if copays_dict:
                        plan_data["copays"] = copays_dict
                
                # Network to lobSpecificData
                if "network" in modal_data:
                    plan_data["lobSpecificData"]["network"] = modal_data["network"]
                    plan_data["rawPlanData"]["network"] = modal_data["network"]
                    plan_data["rawPlanData"]["coverage_details"]["Network"] = modal_data["network"]
                
                # TPA to lobSpecificData
                if "tpa" in modal_data:
                    plan_data["lobSpecificData"]["tpa"] = modal_data["tpa"]
                    plan_data["rawPlanData"]["tpa"] = modal_data["tpa"]
                    plan_data["rawPlanData"]["coverage_details"]["TPA"] = modal_data["tpa"]
                
                # Copay summary
                if "copay_summary" in modal_data:
                    plan_data["rawPlanData"]["copay"] = modal_data["copay_summary"]
                
                # Geographical Scope
                if "geographical_scope" in modal_data:
                    plan_data["lobSpecificData"]["geographicalScope"] = modal_data["geographical_scope"]
                
                # Preexisting Conditions
                if "preexisting_conditions" in modal_data:
                    preexist_value = modal_data["preexisting_conditions"].lower()
                    plan_data["lobSpecificData"]["preexistingConditions"] = preexist_value == "covered"
                
                # Pharmacy Co-insurance percentage
                if "pharmacy_coinsurance" in modal_data:
                    plan_data["lobSpecificData"]["pharmacyCoinsurance"] = f"{modal_data['pharmacy_coinsurance']}%"
                
                # Store modal text for reference
                if "modal_text" in modal_data:
                    plan_data["rawPlanData"]["modal_text"] = self.clean_text(modal_data["modal_text"])
                
                # Create structured network object from modal data (Unified Structure V2)
                tpa_from_modal = plan_data["lobSpecificData"].get("tpa")
                network_from_modal = plan_data["lobSpecificData"].get("network")
                
                if tpa_from_modal or network_from_modal:
                    plan_data["network"] = {
                        "tpa": tpa_from_modal,
                        "networkName": network_from_modal,
                        "networkType": "local"  # default, can be overridden
                    }
            
            # Premium from HTML (second priority)
            if "html_premium" in html_data and html_data["html_premium"]:
                try:
                    p_str = re.sub(r'[^\d.]', '', str(html_data["html_premium"]))
                    plan_data["annualPremium"] = float(p_str)
                    plan_data["monthlyPremium"] = round(plan_data["annualPremium"] / 12, 2)
                except: pass
            
            # Plan name from HTML
            if "html_plan_name" in html_data and html_data["html_plan_name"]:
                # Extract clean plan name - get only the tier/type (e.g., "Platinum 1", "Gold 2")
                raw_plan_name = self.clean_text(html_data["html_plan_name"])
                
                # Extract deductible from plan name before cleaning (e.g., "Ded:20%(Max AED 50/-)")
                ded_match = re.search(r'Ded:(\d+)%(?:\(Max\s+AED\s+([\d,]+))?', raw_plan_name, re.IGNORECASE)
                if ded_match:
                    try:
                        plan_data["deductible"] = float(ded_match.group(1))
                        plan_data["deductibleMetric"] = "%"
                        if ded_match.group(2):
                            max_amount = ded_match.group(2).replace(",", "")
                            plan_data["lobSpecificData"]["deductibleMax"] = f"AED {max_amount}"
                    except:
                        pass
                
                # Pattern: "1 17183 - Platinum 1 - DXB - GN (...) Platinum 8807.97"
                # We want: "Platinum 1"
                # Extract plan name between first " - " and second " - " OR before "("
                plan_name_match = re.search(r'-\s*([A-Za-z]+\s*\d*)\s*(?:-|\(|AED|\d)', raw_plan_name)
                if plan_name_match:
                    plan_data["planName"] = plan_name_match.group(1).strip()
                else:
                    # Fallback: Try to extract any plan tier name
                    tier_match = re.search(r'(Platinum|Diamond|Gold|Silver|Bronze|Asasi|ASASI|Executive|Essential|Limited|Standard|Flexi)(\s+\d+)?', raw_plan_name, re.IGNORECASE)
                    if tier_match:
                        plan_data["planName"] = tier_match.group(0).strip()
                    else:
                        # Last fallback: use cleaned raw name (truncated)
                        plan_data["planName"] = raw_plan_name[:50]
                
                plan_data["rawPlanData"]["plan_name"] = raw_plan_name  # Store full name in raw data
                plan_data["planCode"] = f"ASG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_data['planName'])[:50]}"
                
            if "html_raw_text" in html_data:
                plan_data["rawPlanData"]["html_text"] = self.clean_text(html_data["html_raw_text"])

        # --- EXTRACTION LOGIC (PDF) ---
        try:
            full_text = ""
            with pdfplumber.open(pdf_path) as pdf:
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        # Filter Arabic line by line
                        lines = text.split('\n')
                        cleaned_lines = []
                        for line in lines:
                            cleaned = self.clean_text(line)
                            # Only keep lines that have at least some alphanumeric content
                            if re.search(r'[a-zA-Z0-9]', cleaned):
                                cleaned_lines.append(cleaned)
                        full_text += "\n".join(cleaned_lines) + "\n"
            
            # 1. Plan Name (Fallback if not in HTML)
            if plan_data["planName"] == "Unknown Plan":
                plan_name_match = re.search(r"(Plan\s+\d+|Gold|Silver|Platinum|Basic|Flexi|Asasi\s+\w+)", full_text, re.IGNORECASE)
                if plan_name_match:
                    plan_data["planName"] = plan_name_match.group(0)
                    plan_data["planCode"] = f"ASG-PLA-{re.sub(r'[^a-zA-Z0-9]', '', plan_data['planName'])}"
            
            # 2. Premium (Fallback if not in HTML)
            if plan_data["annualPremium"] == 0:
                premium_match = re.search(r"AED\s*([\d,]+\.?\d*)", full_text)
                if premium_match:
                    try:
                        raw_premium = premium_match.group(1).replace(",", "")
                        plan_data["annualPremium"] = float(raw_premium)
                        plan_data["monthlyPremium"] = round(plan_data["annualPremium"] / 12, 2)
                    except: pass

            # 3. Waiting Period - Extract from PDF
            waiting_period_match = re.search(r'(\d+)\s*(?:-)?months?\s+waiting\s+period', full_text, re.IGNORECASE)
            if not waiting_period_match:
                waiting_period_match = re.search(r'waiting\s+period[:\s]+(\d+)\s*(?:-)?months?', full_text, re.IGNORECASE)
            
            if waiting_period_match:
                try:
                    months = int(waiting_period_match.group(1))
                    days = months * 30
                    plan_data["waitingPeriod"] = days
                    plan_data["waitingPeriodMetric"] = "days"
                    plan_data["waitingPeriods"]["general"] = days
                except:
                    pass
            
            # Also check for specific waiting periods (days)
            if plan_data["waitingPeriod"] == 0:
                days_match = re.search(r'(\d+)\s+days?\s+waiting\s+period', full_text, re.IGNORECASE)
                if days_match:
                    try:
                        days = int(days_match.group(1))
                        plan_data["waitingPeriod"] = days
                        plan_data["waitingPeriods"]["general"] = days
                    except:
                        pass

            # 4. Extract Structured Inpatient & Outpatient Coverage
            inpatient_benefits = []
            outpatient_benefits = []
            
            # Extract In-Patient Treatment section
            inpatient_match = re.search(r'In-Patient Treatment.*?\n(.*?)(?=Out-Patient|Exclusions)', full_text, re.DOTALL | re.IGNORECASE)
            if inpatient_match:
                content = inpatient_match.group(1)
                items = re.findall(r'(\d+\.\s+[A-Za-z][^\n]*(?:\n(?!\d+\.)[^\n]*)*)', content)
                for item in items[:20]:
                    cleaned = self.clean_text(item)
                    if len(cleaned) > 10:
                        cleaned_name = re.sub(r'^\d+\.\s*', '', cleaned)
                        name_match = re.match(r'(.+?)(?:\s+Covered|\s+AED|\s+Free|$)', cleaned_name)
                        benefit_name = name_match.group(1).strip() if name_match else cleaned_name
                        
                        if benefit_name and len(benefit_name) > 3:
                            is_covered = 'Covered' in item or 'AED' in item
                            inpatient_benefits.append({
                                "name": benefit_name,
                                "covered": is_covered,
                                "description": cleaned[:150]
                            })
            
            # Extract Out-Patient Treatment section  
            outpatient_match = re.search(r'Out-Patient.*?Treatment.*?\n(.*?)(?=Exclusions|Emergency outside|Pharmacy)', full_text, re.DOTALL | re.IGNORECASE)
            if outpatient_match:
                content = outpatient_match.group(1)
                items = re.findall(r'(\d+\.\s+[A-Za-z][^\n]*(?:\n(?!\d+\.)[^\n]*)*)', content)
                for item in items[:20]:
                    cleaned = self.clean_text(item)
                    if len(cleaned) > 10:
                        cleaned_name = re.sub(r'^\d+\.\s*', '', cleaned)
                        name_match = re.match(r'(.+?)(?:\s+Covered|\s+AED|\s+Free|$)', cleaned_name)
                        benefit_name = name_match.group(1).strip() if name_match else cleaned_name
                        
                        if benefit_name and len(benefit_name) > 3:
                            is_covered = 'Covered' in item or 'AED' in item or 'Free' in item
                            outpatient_benefits.append({
                                "name": benefit_name,
                                "covered": is_covered,
                                "description": cleaned[:150]
                            })
            
            # Add structured categories if we found them
            if inpatient_benefits:
                plan_data["benefits"].append({
                    "categoryId": "inpatient",
                    "categoryName": "In-Patient Treatment",
                    "benefits": inpatient_benefits
                })
            
            if outpatient_benefits:
                plan_data["benefits"].append({
                    "categoryId": "outpatient",
                    "categoryName": "Out-Patient Treatment",
                    "benefits": outpatient_benefits
                })

            # 5. Additional Benefits Mapping
            benefits_list = []
            
            keywords_map = {
                "Annual limit": "Annual limit",
                "Aggregate Limit": "Annual limit",
                "Dental": "Dental",
                "Pharmacy": "Pharmacy",
                "Optical": "Optical",
                "Physiotherapy": "Physiotherapy",
                "Diagnostics": "Diagnostics",
                "Maternity": "Maternity",
                "Worldwide coverage": "Worldwide coverage",
                "Network": "Network",
                "Co-pay": "Co-pay",
                "Deductible": "Deductible"
            }
            
            lines = full_text.split('\n')
            coverage_details = {}
            
            # Add Premium to coverage_details
            if plan_data["rawPlanData"]["premium"]:
                coverage_details["Premium"] = f"Price starting from :\n{plan_data['rawPlanData']['premium']}"
            elif plan_data["annualPremium"] > 0:
                coverage_details["Premium"] = f"Price starting from :\nAED {int(plan_data['annualPremium'])} + VAT"
            
            # Add Co-pay summary if available
            if plan_data["rawPlanData"]["copay"] and plan_data["rawPlanData"]["copay"] != "N/A":
                copay_parts = []
                if plan_data["copays"]:
                    for key, val in plan_data["copays"].items():
                        copay_parts.append(str(val))
                if copay_parts:
                    coverage_details["Co-pay Consultation\nPharmacy\nDiagnostic"] = "\n".join(copay_parts)
            
            for line in lines:
                if not line.strip(): continue
                
                for key, label in keywords_map.items():
                    if key.lower() in line.lower():
                        value = line.strip()
                        coverage_details[label] = value
                        
                        benefits_list.append({
                            "name": value,
                            "covered": True,
                            "description": value
                        })
                        
                        # Specific Field parsing
                        if label == "Annual limit":
                            if "Million" in value or "1,000,000" in value:
                                plan_data["annualLimit"] = 1000000
                            else:
                                nums = re.findall(r"[\d,]{4,}", value)
                                if nums:
                                    try:
                                        val = nums[0].replace(",", "")
                                        plan_data["annualLimit"] = float(val)
                                    except: pass
                        
                        if label == "Pharmacy":
                            nums = re.findall(r"Pharmacy.*?([\d,]+)", value, re.IGNORECASE)
                            if nums:
                                try:
                                    val = nums[0].replace(",", "")
                                    if val.isdigit():
                                        plan_data["pharmacyLimit"] = float(val)
                                except: pass
                        
                        if label == "Dental":
                            if "2K" in value: plan_data["dentalLimit"] = 2000
                            elif "1K" in value: plan_data["dentalLimit"] = 1000
                            elif "3K" in value: plan_data["dentalLimit"] = 3000
                            else:
                                nums = re.findall(r"Dental.*?AED\s*([\d,]+)", value, re.IGNORECASE)
                                if nums:
                                    try:
                                        val = nums[0].replace(",", "")
                                        plan_data["dentalLimit"] = float(val)
                                    except: pass
                        
                        if label == "Optical":
                            if "1K" in value: plan_data["opticalLimit"] = 1000
                            else:
                                nums = re.findall(r"Optical.*?AED\s*([\d,]+)", value, re.IGNORECASE)
                                if nums:
                                    try:
                                        val = nums[0].replace(",", "")
                                        plan_data["opticalLimit"] = float(val)
                                    except: pass

            # Only add generic "coverage" if we didn't already extract structured benefits
            if benefits_list and not any(b.get('categoryId') in ['inpatient', 'outpatient'] for b in plan_data["benefits"]):
                plan_data["benefits"].append({
                    "categoryId": "coverage",
                    "categoryName": "Coverage Details",
                    "benefits": benefits_list
                })
            
            # Add "Table of benefits" placeholder to coverage_details
            coverage_details["Table of benifits"] = "table of benifits"
                
            plan_data["rawPlanData"]["coverage_details"] = coverage_details
            plan_data["rawPlanData"]["full_text_snippet"] = full_text[:500]

        except FileNotFoundError:
            raise  # Re-raise file not found errors
        except ValueError as e:
            raise  # Re-raise validation errors
        except Exception as e:
            # Check if it's a PDF-specific error
            error_msg = str(e).lower()
            if "pdf" in error_msg or "syntax" in error_msg or "corrupt" in error_msg:
                raise ValueError(f"Invalid or corrupted PDF file: {pdf_path} - {e}")
            else:
                raise RuntimeError(f"Error parsing PDF {pdf_path}: {e}")

        return plan_data

    def parse_json_benefits(self, json_data: Any, html_data: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Parses the insurance plan from JSON API response (alternative to PDF parsing).
        
        Args:
            json_data: JSON response from GetProductPlanTOBByPlanId API
            html_data: Optional dict containing pre-scraped HTML data (plan name, premium, etc.)
            form_data: Optional form data for context (leadId, etc.)
        
        Returns:
            Dictionary in StandardPlan format
        """
        # Initialize Default Structure
        # Get leadId from form_data (vendor_payload should include leadId)
        lead_id = None
        if form_data:
            lead_id = form_data.get('leadId') or form_data.get('id') or form_data.get('lead_id')
        
        plan_data = {
            "id": f"plan-{uuid.uuid4()}",
            "type": "plan",
            "leadId": lead_id if lead_id else str(uuid.uuid4()),
            "vendorId": "vendor-alsagr",
            "vendorPlanId": None,  # Will store Alsagr's planId
            "fetchedAt": datetime.datetime.now().isoformat(),
            "vendorName": "Alsagr Insurance",
            "vendorCode": "ASG",
            "planName": "Unknown Plan",
            "planCode": "ASG-PLA-XX",
            "planType": "gold",
            "annualPremium": 0,
            "monthlyPremium": 0,
            "currency": "AED",
            "annualLimit": 0,
            "inpatientLimit": 0,
            "outpatientLimit": 0,
            "maternityLimit": 0,
            "maternityNormalDelivery": 0,
            "maternityCSection": 0,
            "emergencyLimit": 0,
            "pharmacyLimit": 0,
            "dentalLimit": 0,
            "opticalLimit": 0,
            "deductible": 0,
            "deductibleMetric": "AED",
            "coInsurance": 0,
            "coInsuranceMetric": "%",
            "lobSpecificData": {},
            "benefits": [],
            "exclusions": [],
            "rawPlanData": {
                "source": "json_api",
                "plan_number": None,
                "premium": None,
                "coverage_details": {},
                "metadata": {}
            }
        }
        
        # --- MERGE HTML DATA FIRST ---
        if html_data:
            if "plan_number" in html_data and html_data["plan_number"]:
                plan_data["rawPlanData"]["plan_number"] = html_data["plan_number"]
                plan_data["planCode"] = f"ASG-PLA-{html_data['plan_number']}"
            
            if "html_premium" in html_data and html_data["html_premium"]:
                try:
                    premium_text = str(html_data["html_premium"]).replace(",", "").replace("AED", "").strip()
                    premium_match = re.search(r'([\d,]+\.?\d*)', premium_text)
                    if premium_match:
                        annual_premium = float(premium_match.group(1).replace(",", ""))
                        plan_data["annualPremium"] = annual_premium
                        plan_data["monthlyPremium"] = round(annual_premium / 12, 2)
                        plan_data["rawPlanData"]["premium"] = html_data["html_premium"]
                except: pass
            
            if "html_plan_name" in html_data and html_data["html_plan_name"]:
                # Extract clean plan name - get only the tier/type (e.g., "Platinum 1", "Gold 2")
                raw_plan_name = self.clean_text(html_data["html_plan_name"])
                
                # Extract deductible from plan name before cleaning (e.g., "Ded:20%(Max AED 50/-)")
                ded_match = re.search(r'Ded:(\d+)%(?:\(Max\s+AED\s+([\d,]+))?', raw_plan_name, re.IGNORECASE)
                if ded_match:
                    try:
                        plan_data["deductible"] = float(ded_match.group(1))
                        plan_data["deductibleMetric"] = "%"
                        if ded_match.group(2):
                            max_amount = ded_match.group(2).replace(",", "")
                            plan_data["lobSpecificData"]["deductibleMax"] = f"AED {max_amount}"
                    except:
                        pass
                
                # Pattern: "1 17183 - Platinum 1 - DXB - GN (...) Platinum 8807.97"
                # We want: "Platinum 1"
                # Extract plan name between first " - " and second " - " OR before "("
                plan_name_match = re.search(r'-\s*([A-Za-z]+\s*\d*)\s*(?:-|\(|AED|\d)', raw_plan_name)
                if plan_name_match:
                    plan_data["planName"] = plan_name_match.group(1).strip()
                else:
                    # Fallback: Try to extract any plan tier name
                    tier_match = re.search(r'(Platinum|Diamond|Gold|Silver|Bronze|Asasi|ASASI|Executive|Essential|Limited|Standard|Flexi)(\s+\d+)?', raw_plan_name, re.IGNORECASE)
                    if tier_match:
                        plan_data["planName"] = tier_match.group(0).strip()
                    else:
                        # Last fallback: use cleaned raw name (truncated)
                        plan_data["planName"] = raw_plan_name[:50]
                
                plan_data["rawPlanData"]["plan_name_full"] = raw_plan_name  # Store full name in raw data
        
        # --- PARSE JSON DATA ---
        try:
            if isinstance(json_data, list):
                # JSON is an array of benefits
                coverage_details = {}
                benefits = []
                
                # Extract planId from first benefit (if available)
                if len(json_data) > 0 and json_data[0].get("planId"):
                    plan_data["vendorPlanId"] = str(json_data[0].get("planId"))
                
                for benefit in json_data:
                    try:
                        # Skip inactive benefits
                        if benefit.get("benefitActiveYn") == "N":
                            continue
                        
                        benefit_type = benefit.get("benefitType", "")
                        benefit_value = benefit.get("benefitValue", "")
                        
                        # Clean the benefit text
                        benefit_type_clean = self.clean_text(str(benefit_type))
                        benefit_value_clean = self.clean_text(str(benefit_value))
                        
                        if not benefit_type_clean or not benefit_value_clean:
                            continue
                        
                        # Store in coverage details
                        coverage_details[benefit_type_clean] = benefit_value_clean
                        
                        # Add to benefits array with full details
                        benefits.append({
                            "category": benefit_type_clean,
                            "description": benefit_value_clean,
                            "limit": benefit_value_clean,
                            "benefitId": str(benefit.get("benefitId", "")) if benefit.get("benefitId") else None
                        })
                        
                        # Try to extract specific limits
                        benefit_lower = benefit_type_clean.lower()
                        value_str = str(benefit_value_clean)
                        
                        # Extract numeric values (handle formats like "AED 1,000,000/-" or "20% coinsurance Max 50")
                        numeric_match = re.search(r'AED\s*([\d,]+\.?\d*)', value_str)
                        if not numeric_match:
                            numeric_match = re.search(r'([\d,]+\.?\d*)', value_str.replace(",", ""))
                        numeric_value = float(numeric_match.group(1).replace(",", "")) if numeric_match else 0
                        
                        # Map to standard fields based on benefit type
                        if "aggregate limit" in benefit_lower or "annual limit" in benefit_lower or "overall limit" in benefit_lower:
                            plan_data["annualLimit"] = numeric_value
                        
                        elif "inpatient" in benefit_lower:
                            if numeric_value > 0:
                                plan_data["inpatientLimit"] = numeric_value
                            # Store as text even if no numeric value
                            if "covered" in value_str.lower() or "as per" in value_str.lower():
                                plan_data["inpatientLimit"] = plan_data.get("annualLimit", 0)
                        
                        elif "outpatient" in benefit_lower or "op consultation" in benefit_lower:
                            if numeric_value > 0:
                                plan_data["outpatientLimit"] = numeric_value
                            # Store as text even if no numeric value
                            if "covered" in value_str.lower() or "as per" in value_str.lower():
                                plan_data["outpatientLimit"] = plan_data.get("annualLimit", 0)
                        
                        elif "maternity" in benefit_lower:
                            # Enhanced maternity parsing - extract both normal and C-Section
                            amounts = re.findall(r'AED\s*([\d,]+)', value_str)
                            if len(amounts) >= 2:
                                plan_data["maternityNormalDelivery"] = float(amounts[0].replace(",", ""))
                                plan_data["maternityCSection"] = float(amounts[1].replace(",", ""))
                                plan_data["maternityLimit"] = float(amounts[1].replace(",", ""))  # Use higher value
                            elif amounts:
                                plan_data["maternityLimit"] = float(amounts[0].replace(",", ""))
                                plan_data["maternityNormalDelivery"] = float(amounts[0].replace(",", ""))
                            elif numeric_value > 0:
                                plan_data["maternityLimit"] = numeric_value
                        
                        elif "emergency" in benefit_lower:
                            if numeric_value > 0:
                                plan_data["emergencyLimit"] = numeric_value
                            elif "covered" in value_str.lower() or "100%" in value_str:
                                plan_data["emergencyLimit"] = plan_data.get("annualLimit", 0)
                        
                        elif "pharmacy" in benefit_lower or "medication" in benefit_lower:
                            if "nil" not in value_str.lower():
                                plan_data["pharmacyLimit"] = numeric_value
                        
                        elif "dental" in benefit_lower:
                            if numeric_value > 0:
                                plan_data["dentalLimit"] = numeric_value
                            elif "covered" in value_str.lower():
                                # Set to a default or indicate coverage without limit
                                coverage_details["Dental Coverage"] = "Included"
                        
                        elif "optical" in benefit_lower or "vision" in benefit_lower:
                            if numeric_value > 0:
                                plan_data["opticalLimit"] = numeric_value
                            elif "covered" in value_str.lower():
                                # Set to a default or indicate coverage without limit
                                coverage_details["Optical Coverage"] = "Included"
                        
                        elif "deductible" in benefit_lower:
                            # Extract deductible value - prefer percentage over AED amount
                            percent_match = re.search(r'(\d+)%', value_str)
                            if percent_match:
                                # Deductible as percentage (e.g., "20% Max AED 50")
                                plan_data["deductible"] = float(percent_match.group(1))
                                plan_data["deductibleMetric"] = "%"
                                # Check for max AED amount
                                max_match = re.search(r'Max\s+AED\s+([\d,]+)', value_str, re.IGNORECASE)
                                if max_match:
                                    plan_data["lobSpecificData"]["deductibleMax"] = f"AED {max_match.group(1)}"
                            elif numeric_value > 0:
                                # Deductible as fixed amount
                                plan_data["deductible"] = numeric_value
                                plan_data["deductibleMetric"] = "AED"
                        
                        elif "co-insurance" in benefit_lower or "coinsurance" in benefit_lower or "co-pay" in benefit_lower:
                            # Extract percentage
                            percent_match = re.search(r'(\d+)%', value_str)
                            if percent_match:
                                plan_data["coInsurance"] = float(percent_match.group(1))
                        
                        # Extract additional metadata fields (store in lobSpecificData temporarily)
                        elif "network" in benefit_lower:
                            plan_data["lobSpecificData"]["_networkProvider"] = value_str
                            # Determine network type
                            if "gn" in value_str.lower() or "worldwide" in value_str.lower():
                                plan_data["lobSpecificData"]["_networkType"] = "global"
                            else:
                                plan_data["lobSpecificData"]["_networkType"] = "local"
                        
                        elif "tpa" in benefit_lower:
                            plan_data["lobSpecificData"]["_tpaProvider"] = value_str
                        
                        elif "geographical" in benefit_lower or "scope" in benefit_lower:
                            plan_data["lobSpecificData"]["geographicalScope"] = value_str
                            # Also update network type based on geographical scope
                            if "worldwide" in value_str.lower() or "international" in value_str.lower():
                                plan_data["lobSpecificData"]["_networkType"] = "international"
                        
                        elif "preexisting" in benefit_lower or "pre-existing" in benefit_lower or "chronic" in benefit_lower:
                            plan_data["lobSpecificData"]["preExistingConditions"] = value_str
                    
                    except Exception as e:
                        # Log individual benefit errors but continue processing
                        pass
                
                # Group benefits by category to match frontend expectations
                # Frontend expects: [{categoryId, categoryName, benefits: [...]}]
                categorized_benefits = {}
                for benefit in benefits:
                    category = benefit.get("category", "General")
                    if category not in categorized_benefits:
                        categorized_benefits[category] = []
                    
                    # Convert to expected benefit structure
                    categorized_benefits[category].append({
                        "name": category,
                        "description": benefit.get("description", ""),
                        "covered": True,
                        "limit": benefit.get("limit", ""),
                        "benefitId": benefit.get("benefitId")
                    })
                
                # Convert to frontend-expected format
                grouped_benefits = []
                for category_name, category_benefits in categorized_benefits.items():
                    # Generate a category ID
                    category_id = category_name.lower().replace(" ", "-").replace("/", "-")
                    grouped_benefits.append({
                        "categoryId": category_id,
                        "categoryName": category_name,
                        "benefits": category_benefits
                    })
                
                plan_data["benefits"] = grouped_benefits
                plan_data["rawPlanData"]["coverage_details"] = coverage_details
                plan_data["rawPlanData"]["benefit_count"] = len(benefits)
                plan_data["rawPlanData"]["original_benefits"] = benefits  # Keep original for debugging
                
                # Store metadata from JSON
                if len(json_data) > 0:
                    sample_benefit = json_data[0]
                    plan_data["rawPlanData"]["metadata"] = {
                        "productPlanId": str(sample_benefit.get("productPlanId", "")),
                        "productId": str(sample_benefit.get("productId", "")),
                        "tobType": str(sample_benefit.get("tobType", ""))
                    }
            
            elif isinstance(json_data, dict):
                # JSON is a single object (less common)
                plan_data["rawPlanData"]["json_structure"] = "single_object"
                # Try to extract any useful fields
                for key, value in json_data.items():
                    plan_data["rawPlanData"]["coverage_details"][key] = str(value)
        
        except Exception as e:
            # Store error in raw data
            plan_data["rawPlanData"]["parse_error"] = str(e)
        
        # Create structured network object (Unified Structure V2)
        network_provider = plan_data["lobSpecificData"].pop("_networkProvider", None)
        tpa_provider = plan_data["lobSpecificData"].pop("_tpaProvider", None)
        network_type = plan_data["lobSpecificData"].pop("_networkType", "local")
        
        if network_provider or tpa_provider:
            plan_data["network"] = {
                "tpa": tpa_provider,
                "networkName": network_provider,
                "networkType": network_type
            }
        
        return plan_data



