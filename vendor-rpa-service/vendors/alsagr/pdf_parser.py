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
        
        # Extract In-Patient Treatment section
        inpatient_match = re.search(r'In-Patient Treatment.*?\n(.*?)(?=Out-Patient|Exclusions)', full_text, re.DOTALL | re.IGNORECASE)
        if inpatient_match:
            content = inpatient_match.group(1)
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
        
        if outpatient_benefits:
            base_plan_data["benefits"].append({
                "categoryId": "outpatient",
                "categoryName": "Out-Patient Treatment",
                "benefits": outpatient_benefits
            })

        # Store PDF text snippet in raw data
        if "rawPlanData" not in base_plan_data:
            base_plan_data["rawPlanData"] = {}
        base_plan_data["rawPlanData"]["pdf_text_snippet"] = full_text[:500]
        base_plan_data["rawPlanData"]["pdf_extracted"] = True

    except Exception as e:
        print(f"Error parsing PDF {pdf_path}: {e}", file=sys.stderr)
        # Don't fail the whole plan if PDF parsing fails
        if "rawPlanData" not in base_plan_data:
            base_plan_data["rawPlanData"] = {}
        base_plan_data["rawPlanData"]["pdf_error"] = str(e)
    finally:
        # CLEANUP: Delete PDF after parsing to save disk space
        try:
            if os.path.exists(pdf_path):
                os.remove(pdf_path)
                print(f"  🗑️  Cleaned up PDF: {os.path.basename(pdf_path)}", flush=True, file=sys.stderr)
        except Exception as cleanup_error:
            # Don't fail if cleanup fails, just log it
            print(f"  ⚠️ Failed to cleanup PDF {pdf_path}: {cleanup_error}", file=sys.stderr)

    return base_plan_data
