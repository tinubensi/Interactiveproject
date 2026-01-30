"""
Alsagr PDF Parser
Extracts detailed plan data from downloaded PDF files
Adapted from alsagar-rpa/pdf_parser.py
"""
import pdfplumber
import re
import os
import sys
from typing import Dict, Any, Optional


def clean_text(text: str) -> str:
    """
    Removes Arabic characters, replacement characters, and extra whitespace.
    """
    if not text:
        
        return ""
    
    # Remove Unicode replacement character
    text = text.replace('\ufffd', '')
    text = text.replace('�', '')
    
    # Remove Arabic characters (Unicode range 0600-06FF) and Arabic Supplement (0750-077F)
    text = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', '', text)
    
    # Remove other non-printable characters and control characters
    text = re.sub(r'[\x00-\x1F\x7F-\x9F]+', ' ', text)
    
    # Remove extra spaces/newlines
    text = re.sub(r'\s+', ' ', text).strip()
    return text


async def parse_plan_pdf(pdf_path: str, base_plan_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Parses the insurance plan PDF and enriches the base plan data.
    
    Args:
        pdf_path: Path to the downloaded PDF file
        base_plan_data: Existing plan data from API/modal extraction
    
    Returns:
        Enriched plan data with PDF-extracted information
    """
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
                        cleaned = clean_text(line)
                        # Only keep lines that have at least some alphanumeric content
                        if re.search(r'[a-zA-Z0-9]', cleaned):
                            cleaned_lines.append(cleaned)
                    full_text += "\n".join(cleaned_lines) + "\n"
        
        # Extract Waiting Period
        waiting_period_match = re.search(r'(\d+)\s*(?:-)?months?\s+waiting\s+period', full_text, re.IGNORECASE)
        if not waiting_period_match:
            waiting_period_match = re.search(r'waiting\s+period[:\s]+(\d+)\s*(?:-)?months?', full_text, re.IGNORECASE)
        
        if waiting_period_match:
            try:
                months = int(waiting_period_match.group(1))
                days = months * 30  # Convert months to days
                base_plan_data["waitingPeriod"] = days
                base_plan_data["waitingPeriodMetric"] = "days"
                if "waitingPeriods" not in base_plan_data:
                    base_plan_data["waitingPeriods"] = {}
                base_plan_data["waitingPeriods"]["general"] = days
            except:
                pass
        
        # Also check for specific waiting periods (days)
        if base_plan_data.get("waitingPeriod", 0) == 0:
            days_match = re.search(r'(\d+)\s+days?\s+waiting\s+period', full_text, re.IGNORECASE)
            if days_match:
                try:
                    days = int(days_match.group(1))
                    base_plan_data["waitingPeriod"] = days
                    if "waitingPeriods" not in base_plan_data:
                        base_plan_data["waitingPeriods"] = {}
                    base_plan_data["waitingPeriods"]["general"] = days
                except:
                    pass

        # Extract Structured Inpatient & Outpatient Coverage
        inpatient_benefits = []
        outpatient_benefits = []
        inpatient_limit = None
        
        # Extract In-Patient Treatment section
        inpatient_match = re.search(r'In-Patient Treatment.*?\n(.*?)(?=Out-Patient|Exclusions)', full_text, re.DOTALL | re.IGNORECASE)
        if inpatient_match:
            content = inpatient_match.group(1)
            
            # Extract inpatient limit from the section
            # Look for patterns like "AED 500,000/-" or "AED 500,000" or "Covered as per annual limit"
            inpatient_limit_patterns = [
                r'In-Patient.*?AED\s*([\d,]+(?:\.\d+)?)',
                r'In-Patient.*?limit.*?AED\s*([\d,]+(?:\.\d+)?)',
                r'AED\s*([\d,]+(?:\.\d+)?).*?In-Patient',
                r'Covered.*?as\s+per.*?annual\s+limit',
            ]
            for pattern in inpatient_limit_patterns:
                limit_match = re.search(pattern, content, re.IGNORECASE | re.DOTALL)
                if limit_match:
                    try:
                        if 'annual limit' in limit_match.group(0).lower():
                            # If it says "as per annual limit", use annualLimit if available
                            if base_plan_data.get("annualLimit"):
                                inpatient_limit = base_plan_data.get("annualLimit")
                                break
                        else:
                            inpatient_limit = float(limit_match.group(1).replace(",", ""))
                            break
                    except:
                        continue
            
            # If no specific limit found, check if it says "Covered" or "as per annual limit"
            if not inpatient_limit:
                if re.search(r'Covered.*?as\s+per.*?annual|as\s+per.*?annual.*?limit', content, re.IGNORECASE):
                    inpatient_limit = base_plan_data.get("annualLimit", 0)
                elif re.search(r'Covered\s+(?:in\s+full|fully)', content, re.IGNORECASE):
                    # If it says "Covered in full", use annual limit
                    inpatient_limit = base_plan_data.get("annualLimit", 0)
            
            # Extract numbered items (1. , 2. , etc.)
            items = re.findall(r'(\d+\.\s+[A-Za-z][^\n]*(?:\n(?!\d+\.)[^\n]*)*)', content)
            for item in items[:20]:
                cleaned = clean_text(item)
                if len(cleaned) > 10:
                    # Remove leading number
                    cleaned_name = re.sub(r'^\d+\.\s*', '', cleaned)
                    # Extract just the service name (before "Covered" or price)
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
            # Extract numbered items (1. , 2. , etc.)
            items = re.findall(r'(\d+\.\s+[A-Za-z][^\n]*(?:\n(?!\d+\.)[^\n]*)*)', content)
            for item in items[:20]:
                cleaned = clean_text(item)
                if len(cleaned) > 10:
                    # Remove leading number
                    cleaned_name = re.sub(r'^\d+\.\s*', '', cleaned)
                    # Extract just the service name (before "Covered" or price)
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
        if "benefits" not in base_plan_data:
            base_plan_data["benefits"] = []
            
        if inpatient_benefits:
            base_plan_data["benefits"].append({
                "categoryId": "inpatient",
                "categoryName": "In-Patient Treatment",
                "benefits": inpatient_benefits
            })
            
        # Set inpatientLimit if extracted from PDF
        if inpatient_limit is not None:
            base_plan_data["inpatientLimit"] = inpatient_limit
        elif inpatient_benefits and base_plan_data.get("annualLimit"):
            # If we have inpatient benefits but no specific limit, use annual limit
            base_plan_data["inpatientLimit"] = base_plan_data.get("annualLimit", 0)
            
        if outpatient_benefits:
            base_plan_data["benefits"].append({
                "categoryId": "outpatient",
                "categoryName": "Out-Patient Treatment",
                "benefits": outpatient_benefits
            })

        # Extract Alternative Medicine coverage with detailed information
        # Looking for: "13. Alternative Medicine Covered - Homeopathy & Ayurveda - AED 2,500 per person per year - 20% coinsurance"
        alt_med_section = None
        alt_med_patterns = [
            r'13\.\s*Alternative\s+Medicine.*?(?=\d+\.|Claims|Exclusions|Other|$)',
            r'Alternative\s+Medicine.*?Homeopathy.*?Ayurveda.*?(?=\d+\.|Claims|Exclusions|Other|$)',
            r'Alternative\s+Medicine.*?(?=\d+\.|Claims|Exclusions|Other|$)',
            r'Homeopathy.*?Ayurveda.*?(?=\d+\.|Claims|Exclusions|Other|$)',
            # Also try to find it by looking for the key phrases even if section number is missing
            r'(?:Alternative\s+Medicine|Homeopathy|Ayurveda).*?(?:AED\s*[\d,]+|coinsurance|Covered|reimbursement).*?(?=\d+\.|Claims|Exclusions|Other|$)'
        ]
        
        for pattern in alt_med_patterns:
            alt_med_match = re.search(pattern, full_text, re.DOTALL | re.IGNORECASE)
            if alt_med_match:
                alt_med_section = alt_med_match.group(0)
                # Make sure we got a reasonable amount of text (not just a few words)
                if len(alt_med_section.strip()) > 20:
                    break
        
        # If we didn't find a section but we see "Alternative Medicine" or "Homeopathy" or "Ayurveda" in the text,
        # try to extract from a wider context (up to 500 chars after the mention)
        if not alt_med_section:
            alt_med_mention = re.search(r'(?:Alternative\s+Medicine|Homeopathy|Ayurveda)', full_text, re.IGNORECASE)
            if alt_med_mention:
                start_pos = alt_med_mention.start()
                end_pos = min(start_pos + 500, len(full_text))
                alt_med_section = full_text[start_pos:end_pos]
        
        if alt_med_section:
            # Logging suppressed for clean JSON output
            pass
            # Extract limit (AED 2,500 per person per year)
            # Text may be split: "AED 2,500 per person per year" or "AED 2,500 per person per year" across lines
            # Try multiple patterns for limit extraction (handle split text)
            limit_patterns = [
                r'AED\s*([\d,]+(?:\.\d+)?)\s*per\s+person\s+per\s+year',  # Exact match
                r'AED\s*([\d,]+(?:\.\d+)?)\s*per\s+person',  # Without "per year"
                r'AED\s*([\d,]+(?:\.\d+)?)\s*PPPY',  # Abbreviated
                r'limit\s+of\s+AED\s*([\d,]+(?:\.\d+)?)',  # "limit of AED X"
                r'Covered\s+up\s+to\s+a\s+limit\s+of\s+AED\s*([\d,]+(?:\.\d+)?)',  # Full phrase
                r'AED\s*([\d,]+(?:\.\d+)?).*?per\s+person.*?per\s+year',  # Flexible - words can be separated
                r'AED\s*([\d,]+(?:\.\d+)?).*?person.*?year',  # Most flexible - just find AED amount near "person" and "year"
            ]
            alt_med_limit = None
            for limit_pattern in limit_patterns:
                limit_match = re.search(limit_pattern, alt_med_section, re.IGNORECASE | re.DOTALL)
                if limit_match:
                    try:
                        alt_med_limit = float(limit_match.group(1).replace(",", ""))
                        break
                    except:
                        continue
            
            # If still not found, try to find any AED amount in the section (fallback)
            if not alt_med_limit:
                any_aed_match = re.search(r'AED\s*([\d,]+(?:\.\d+)?)', alt_med_section, re.IGNORECASE)
                if any_aed_match and 'limit' in alt_med_section.lower():
                    try:
                        alt_med_limit = float(any_aed_match.group(1).replace(",", ""))
                    except:
                        pass
            
            # Extract coinsurance percentage (20% coinsurance)
            # Text may be split: "Outpatient: 20% coinsurance payable by the insured per visit"
            # Try multiple patterns (handle split text)
            coinsurance_patterns = [
                r'Outpatient:\s*(\d+)%\s*coinsurance\s+payable',  # "Outpatient: 20% coinsurance payable"
                r'(\d+)%\s*coinsurance\s+payable\s+by\s+the\s+insured',  # Full phrase
                r'(\d+)%\s*coinsurance\s+payable',  # Shorter
                r'(\d+)%\s*coinsurance',  # Just percentage + coinsurance
                r'Outpatient.*?(\d+)%.*?coinsurance',  # Flexible - "Outpatient" and "%" and "coinsurance" can be separated
                r'(\d+)%.*?coinsurance.*?payable',  # Flexible - "%" and "coinsurance" and "payable" can be separated
            ]
            alt_med_coinsurance = None
            for coinsurance_pattern in coinsurance_patterns:
                coinsurance_match = re.search(coinsurance_pattern, alt_med_section, re.IGNORECASE | re.DOTALL)
                if coinsurance_match:
                    try:
                        alt_med_coinsurance = float(coinsurance_match.group(1))
                        break
                    except:
                        continue
            
            # If still not found, try to find any percentage near "coinsurance" (fallback)
            if not alt_med_coinsurance:
                coinsurance_mention = re.search(r'coinsurance', alt_med_section, re.IGNORECASE)
                if coinsurance_mention:
                    # Look for percentage before or after "coinsurance" (within 50 chars)
                    context_start = max(0, coinsurance_mention.start() - 50)
                    context_end = min(len(alt_med_section), coinsurance_mention.end() + 50)
                    context = alt_med_section[context_start:context_end]
                    pct_match = re.search(r'(\d+)%', context, re.IGNORECASE)
                    if pct_match:
                        try:
                            alt_med_coinsurance = float(pct_match.group(1))
                        except:
                            pass
            
            # Extract coverage type (Covered, On reimbursement, etc.)
            is_covered = bool(re.search(r'Covered', alt_med_section, re.IGNORECASE))
            reimbursement_only = bool(re.search(r'On\s+reimbursement|reimbursement\s+Only|reimbursable', alt_med_section, re.IGNORECASE))
            
            # Extract providers info (if mentioned) - "under listed providers"
            providers_match = re.search(r'(?:under|from|at)\s+(?:listed\s+)?providers?[:\s]*([^\n\.]+)', alt_med_section, re.IGNORECASE)
            providers = clean_text(providers_match.group(1).strip()) if providers_match else None
            
            # Extract follow-up visit info (if mentioned) - "No coinsurance if a follow-up visit made within seven days"
            # Text may be split across lines, so use DOTALL
            followup_match = re.search(r'follow-up.*?(\d+)\s+days?|(\d+)\s+days?.*?follow-up', alt_med_section, re.IGNORECASE | re.DOTALL)
            followup_days = None
            if followup_match:
                followup_days = int(followup_match.group(1) or followup_match.group(2))
            no_coinsurance_followup = bool(re.search(r'No\s+coinsurance.*?follow-up|follow-up.*?No\s+coinsurance|No\s+coinsurance.*?follow.*?up', alt_med_section, re.IGNORECASE | re.DOTALL))
            
            # Store structured alternative medicine data
            if "lobSpecificData" not in base_plan_data:
                base_plan_data["lobSpecificData"] = {}
            
            base_plan_data["lobSpecificData"]["alternativeMedicine"] = {
                "covered": is_covered,
                "reimbursementOnly": reimbursement_only,
                "limit": alt_med_limit,
                "limitMetric": "AED per person per year" if alt_med_limit else None,
                "coinsurance": alt_med_coinsurance,
                "coinsuranceMetric": "%" if alt_med_coinsurance else None,
                "providers": providers,
                "followupDays": followup_days,
                "noCoinsuranceOnFollowup": no_coinsurance_followup,
                "description": clean_text(alt_med_section[:200])
            }
            # Logging suppressed for clean JSON output
            pass
            
            # Also store in rawPlanData for reference
            if "rawPlanData" not in base_plan_data:
                base_plan_data["rawPlanData"] = {}
            base_plan_data["rawPlanData"]["alternative_medicine"] = {
                "limit": alt_med_limit,
                "coinsurance": alt_med_coinsurance,
                "covered": is_covered,
                "reimbursement_only": reimbursement_only,
                "raw_text": clean_text(alt_med_section[:300])
            }
        
        # Check if Alternative Medicine is mentioned but not fully parsed
        # This is a fallback - if we found the section but couldn't extract details, or if it's mentioned elsewhere
        if not base_plan_data.get("lobSpecificData", {}).get("alternativeMedicine"):
            # Logging suppressed
            pass
            # Search the entire PDF text for any mention
            alt_med_anywhere = re.search(r'alternative\s+medicine|homeopathy|ayurveda', full_text, re.IGNORECASE)
            if alt_med_anywhere:
                # Logging suppressed
                pass
                if "lobSpecificData" not in base_plan_data:
                    base_plan_data["lobSpecificData"] = {}
                # Try to extract at least basic info from the context
                context_start = max(0, alt_med_anywhere.start() - 100)
                context_end = min(len(full_text), alt_med_anywhere.end() + 400)
                context = full_text[context_start:context_end]
                
                # Try to extract limit and coinsurance from context
                limit_match = re.search(r'AED\s*([\d,]+(?:\.\d+)?)', context, re.IGNORECASE)
                coinsurance_match = re.search(r'(\d+)%\s*coinsurance', context, re.IGNORECASE)
                
                alt_med_data = {
                    "covered": bool(re.search(r'Covered', context, re.IGNORECASE)),
                    "description": clean_text(context[:200])
                }
                
                if limit_match:
                    try:
                        alt_med_data["limit"] = float(limit_match.group(1).replace(",", ""))
                        alt_med_data["limitMetric"] = "AED per person per year"
                    except:
                        pass
                
                if coinsurance_match:
                    try:
                        alt_med_data["coinsurance"] = float(coinsurance_match.group(1))
                        alt_med_data["coinsuranceMetric"] = "%"
                    except:
                        pass
                
                base_plan_data["lobSpecificData"]["alternativeMedicine"] = alt_med_data
        
        # Extract Claims Settlement Basis
        # Looking for: "8. Claims Settlement Basis (as per Usual, Customary and Reasonable Charges of the Network in UAE)."
        # "Within the Network on Direct Billing Basis"
        # "Outside the Network on Reimbursement Basis"
        # Note: Text may be split across lines, so we need flexible patterns
        claims_settlement_patterns = [
            r'8\.\s*Claims\s+Settlement\s+Basis.*?(?=\d+\.|Claims|Exclusions|Other|$)',
            r'Claims\s+Settlement\s+Basis.*?(?=\d+\.|Claims|Exclusions|Other|$)',
            r'Settlement\s+Basis.*?(?=\d+\.|Claims|Exclusions|$)',
            # Also try to capture a larger section if the above don't work
            r'8\.\s*Claims\s+Settlement.*?(?:Direct\s+Billing|Reimbursement).*?(?=\d+\.|Claims|Exclusions|Other|$)'
        ]
        
        claims_settlement_section = None
        for pattern in claims_settlement_patterns:
            claims_match = re.search(pattern, full_text, re.DOTALL | re.IGNORECASE)
            if claims_match:
                claims_settlement_section = claims_match.group(0)
                # Make sure we got meaningful content
                if len(claims_settlement_section.strip()) > 30:
                    break
        
        # If we didn't find a section but we see "Claims Settlement Basis" in the text,
        # try to extract from a wider context (up to 500 chars after the mention)
        if not claims_settlement_section:
            claims_mention = re.search(r'Claims\s+Settlement\s+Basis', full_text, re.IGNORECASE)
            if claims_mention:
                start_pos = claims_mention.start()
                end_pos = min(start_pos + 500, len(full_text))
                claims_settlement_section = full_text[start_pos:end_pos]
        
        if claims_settlement_section:
            # Extract Direct Billing info (Within Network)
            # Pattern variations: "Within the Network on Direct Billing Basis" or "Within the Network on ) .8 ... Direct Billing Basis"
            # Handle text that may be split across lines or have formatting issues
            # The actual text shows: "Within the Network on ) .8 ... Direct Billing Basis"
            direct_billing_patterns = [
                r'Within\s+(?:the\s+)?Network\s+on\s+Direct\s+Billing\s+Basis',  # Exact match
                r'Within.*?Network.*?Direct\s+Billing',  # Flexible - words can be separated
                r'Direct\s+Billing\s+Basis',  # Just look for "Direct Billing Basis" if "Within Network" is nearby
                r'Within.*?Network.*?Billing\s+Basis',
                r'Within.*?Billing'  # Most flexible
            ]
            has_direct_billing = False
            for pattern in direct_billing_patterns:
                if re.search(pattern, claims_settlement_section, re.IGNORECASE | re.DOTALL):
                    has_direct_billing = True
                    break
            
            # Also check if "Direct Billing" appears anywhere in the section (even if "Within Network" is separated)
            # This is the key fallback - the text shows "Within the Network on ) .8 ... Direct Billing Basis"
            if not has_direct_billing:
                # Check for "Direct Billing" (case insensitive, flexible spacing)
                if re.search(r'Direct.*?Billing', claims_settlement_section, re.IGNORECASE):
                    # Check if "Within" and "Network" also appear (even if separated by formatting)
                    if re.search(r'Within', claims_settlement_section, re.IGNORECASE) and re.search(r'Network', claims_settlement_section, re.IGNORECASE):
                        has_direct_billing = True
                # Even simpler: if we see "Direct Billing Basis" and "Within" and "Network" anywhere in the section
                elif re.search(r'Direct.*?Billing.*?Basis', claims_settlement_section, re.IGNORECASE):
                    if re.search(r'Within', claims_settlement_section, re.IGNORECASE) and re.search(r'Network', claims_settlement_section, re.IGNORECASE):
                        has_direct_billing = True
            
            # Extract Reimbursement info (Outside Network)
            # Pattern variations: "Outside the Network on Reimbursement Basis"
            reimbursement_patterns = [
                r'Outside\s+(?:the\s+)?Network\s+on\s+Reimbursement\s+Basis',  # Exact match
                r'Outside.*?Network.*?Reimbursement',  # Flexible
                r'Reimbursement\s+Basis.*?Outside.*?Network',
                r'Outside.*?Network.*?Reimbursement',
                r'Outside.*?Reimbursement'  # Most flexible
            ]
            has_reimbursement = False
            for pattern in reimbursement_patterns:
                if re.search(pattern, claims_settlement_section, re.IGNORECASE | re.DOTALL):
                    has_reimbursement = True
                    break
            
            # Also check if "Reimbursement" appears anywhere in the section
            if not has_reimbursement:
                # Check for "Reimbursement" (case insensitive, flexible spacing)
                if re.search(r'Reimbursement', claims_settlement_section, re.IGNORECASE):
                    # Check if "Outside" and "Network" also appear (even if separated by formatting)
                    if re.search(r'Outside', claims_settlement_section, re.IGNORECASE) and re.search(r'Network', claims_settlement_section, re.IGNORECASE):
                        has_reimbursement = True
                # Even simpler: if we see "Reimbursement Basis" and "Outside" and "Network" anywhere in the section
                elif re.search(r'Reimbursement.*?Basis', claims_settlement_section, re.IGNORECASE):
                    if re.search(r'Outside', claims_settlement_section, re.IGNORECASE) and re.search(r'Network', claims_settlement_section, re.IGNORECASE):
                        has_reimbursement = True
            
            # Extract additional details if mentioned
            # Pattern: "as per Usual, Customary and Reasonable Charges"
            usual_customary_match = re.search(r'Usual.*?Customary.*?Reasonable', claims_settlement_section, re.IGNORECASE | re.DOTALL)
            has_ucr = bool(usual_customary_match)
            
            # Extract network location if mentioned (e.g., "in UAE")
            network_location_match = re.search(r'(?:in|of)\s+the\s+Network\s+in\s+([A-Z]{2,3})|Network\s+in\s+([A-Z]{2,3})|in\s+([A-Z]{2,3})', claims_settlement_section, re.IGNORECASE)
            network_location = None
            if network_location_match:
                network_location = network_location_match.group(1) or network_location_match.group(2) or network_location_match.group(3)
            
            # Store structured claims settlement data
            if "lobSpecificData" not in base_plan_data:
                base_plan_data["lobSpecificData"] = {}
            
            base_plan_data["lobSpecificData"]["claimsSettlementBasis"] = {
                "withinNetwork": {
                    "method": "Direct Billing" if has_direct_billing else None,
                    "available": has_direct_billing
                },
                "outsideNetwork": {
                    "method": "Reimbursement" if has_reimbursement else None,
                    "available": has_reimbursement
                },
                "usesUCR": has_ucr,
                "networkLocation": network_location if 'network_location' in locals() else None,
                "description": clean_text(claims_settlement_section[:200])
            }
            
            # Also store in rawPlanData for reference
            if "rawPlanData" not in base_plan_data:
                base_plan_data["rawPlanData"] = {}
            base_plan_data["rawPlanData"]["claims_settlement_basis"] = {
                "direct_billing_within_network": has_direct_billing,
                "reimbursement_outside_network": has_reimbursement,
                "uses_ucr": has_ucr,
                "raw_text": clean_text(claims_settlement_section[:300])
            }
        
        # Extract Physiotherapy coverage
        physio_patterns = [
            r'Physiotherapy[:\s]+(.*?)(?:\n|AED|Covered|sessions)',
            r'(\d+)\s+sessions\s+(?:per|of)\s+(?:annum|year|person).*?physiotherapy',
            r'physiotherapy.*?(\d+)\s+sessions'
        ]
        for pattern in physio_patterns:
            physio_match = re.search(pattern, full_text, re.IGNORECASE)
            if physio_match:
                physio_value = clean_text(physio_match.group(1) if len(physio_match.groups()) > 0 else physio_match.group(0))
                if physio_value:
                    if "lobSpecificData" not in base_plan_data:
                        base_plan_data["lobSpecificData"] = {}
                    base_plan_data["lobSpecificData"]["physiotherapy"] = physio_value
                    if "rawPlanData" not in base_plan_data:
                        base_plan_data["rawPlanData"] = {}
                    base_plan_data["rawPlanData"]["physiotherapy"] = physio_value
                    break
        
        # Store PDF text snippet in raw data
        if "rawPlanData" not in base_plan_data:
            base_plan_data["rawPlanData"] = {}
        base_plan_data["rawPlanData"]["pdf_text_snippet"] = full_text[:500]
        base_plan_data["rawPlanData"]["pdf_extracted"] = True

    except Exception as e:
        pass  # Suppress error output
        # Don't fail the whole plan if PDF parsing fails
        if "rawPlanData" not in base_plan_data:
            base_plan_data["rawPlanData"] = {}
        base_plan_data["rawPlanData"]["pdf_error"] = str(e)
    finally:
        # CLEANUP: Delete PDF after parsing to save disk space
        try:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
                pass  # Suppress cleanup message
        except Exception as cleanup_error:
            # Don't fail if cleanup fails, just log it
            pass  # Suppress cleanup error

    return base_plan_data
