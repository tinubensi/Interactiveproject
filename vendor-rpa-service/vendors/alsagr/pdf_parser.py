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


def clean_text(text: str, preserve_structure: bool = False) -> str:
    """
    Enhanced text cleaning that preserves meaning while removing artifacts.
    
    Args:
        text: Raw text from PDF
        preserve_structure: Keep newlines and spacing for structured content
    
    Returns:
        Cleaned text with PDF artifacts removed but content preserved
    """
    if not text:
        return ""
    
    # Step 1: Remove Unicode replacement characters
    text = text.replace('\ufffd', '')
    text = text.replace('�', '')
    
    # Step 2: Remove Arabic characters
    text = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', '', text)
    
    # Step 3: Clean PDF formatting artifacts (NEW - fixes garbled text)
    # Remove standalone periods with spaces: ". ." or ") ."
    text = re.sub(r'\s*\.\s*\.\s*', ' ', text)
    text = re.sub(r'\)\s*\.\s*', ') ', text)
    text = re.sub(r'\(\s*\)\s*', ' ', text)  # Empty parentheses
    text = re.sub(r'\s+\.\s+', '. ', text)   # Space-period-space → period-space
    
    # Step 4: Clean up numbering artifacts (. 1, . 2, etc.)
    text = re.sub(r'\.\s*(\d+)\s+', r'\1. ', text)
    
    # Step 5: Remove control characters but preserve newlines if requested
    if preserve_structure:
        text = re.sub(r'[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]+', ' ', text)
    else:
        text = re.sub(r'[\x00-\x1F\x7F-\x9F]+', ' ', text)
    
    # Step 6: Normalize whitespace
    if preserve_structure:
        # Keep newlines but normalize spaces on each line
        lines = text.split('\n')
        text = '\n'.join(re.sub(r' +', ' ', line.strip()) for line in lines if line.strip())
    else:
        text = re.sub(r'\s+', ' ', text).strip()
    
    # Step 7: Clean sentence endings
    text = re.sub(r'\s+([.,!?])', r'\1', text)  # Remove space before punctuation
    text = re.sub(r'\.{2,}', '.', text)          # Multiple dots → single dot
    
    # Step 8: Clean up isolated punctuation artifacts
    text = re.sub(r'\s+\.\s+', '. ', text)       # Isolated periods
    text = re.sub(r'\(\s+', '(', text)           # Space after opening parenthesis
    text = re.sub(r'\s+\)', ')', text)           # Space before closing parenthesis
    
    return text


def extract_complete_section(text: str, start_pos: int, max_chars: int = 2000) -> str:
    """
    Extracts a complete section or paragraph starting from start_pos.
    Continues until reaching a natural boundary (double newline, next section number, etc.)
    or max_chars, whichever comes first.
    
    Args:
        text: Full PDF text
        start_pos: Starting position in text
        max_chars: Maximum characters to extract
    
    Returns:
        Complete section text
    """
    end_pos = min(start_pos + max_chars, len(text))
    excerpt = text[start_pos:end_pos]
    
    # Look for natural section boundaries:
    # 1. Double newline (paragraph break)
    # 2. Next numbered section (e.g., "14.", "15.")
    # 3. Major section keywords
    boundaries = [
        (r'\n\n', 0),  # Double newline
        (r'\n\d+\.\s+[A-Z]', 0),  # Next numbered section
        (r'\n(?:Exclusions|Other\s+Benefits|Notes|Important)', 0),  # Major sections
    ]
    
    earliest_boundary = len(excerpt)
    for pattern, offset in boundaries:
        match = re.search(pattern, excerpt)
        if match and match.start() > 50:  # Ignore if too early (likely within same section)
            earliest_boundary = min(earliest_boundary, match.start() + offset)
    
    # If no boundary found, look for last complete sentence
    if earliest_boundary == len(excerpt):
        # Find last sentence ending (period followed by space and capital letter, or end of text)
        sentence_matches = list(re.finditer(r'\.\s+(?=[A-Z])', excerpt))
        if sentence_matches:
            last_sentence = sentence_matches[-1]
            earliest_boundary = last_sentence.end()
    
    return excerpt[:earliest_boundary].strip()


def validate_text_quality(text: str, field_name: str = "unknown") -> bool:
    """
    Validates that extracted text is of good quality.
    
    Args:
        text: Text to validate
        field_name: Name of field for logging
    
    Returns:
        True if text passes quality checks
    """
    if not text or len(text) < 20:
        return False
    
    # Check for excessive punctuation artifacts (more than 5% of text)
    punct_count = text.count('.') + text.count('(') + text.count(')')
    if punct_count > len(text) * 0.05:
        return False
    
    # Check that it contains at least one complete sentence or meaningful phrase
    has_sentence = bool(re.search(r'[A-Z][^.!?]*[.!?]', text))
    has_meaningful_content = len(text.split()) >= 5
    
    return has_sentence or has_meaningful_content


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
                    # FIXED: Clean the entire page text, not line-by-line
                    # This preserves section headers that may span multiple lines
                    cleaned_page = clean_text(text, preserve_structure=True)
                    full_text += cleaned_page + "\n"
        
        # DEBUG: Check if section headers exist in full_text
        print(f"[PDF Parser] Full text length: {len(full_text)} chars", file=sys.stderr)
        if re.search(r'In-Patient', full_text, re.IGNORECASE):
            print(f"[PDF Parser] ✓ 'In-Patient' found in full text", file=sys.stderr)
        else:
            print(f"[PDF Parser] ❌ 'In-Patient' NOT found in full text", file=sys.stderr)
            # Show a sample to debug
            sample = full_text[:2000] if len(full_text) > 2000 else full_text
            print(f"[PDF Parser] Text sample: {sample[:500]}...", file=sys.stderr)
        if re.search(r'Out-Patient', full_text, re.IGNORECASE):
            print(f"[PDF Parser] ✓ 'Out-Patient' found in full text", file=sys.stderr)
        else:
            print(f"[PDF Parser] ❌ 'Out-Patient' NOT found in full text", file=sys.stderr)
        
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

        # ADAPTIVE FORMAT DETECTION AND PARSING
        # Detect which format the PDF uses
        inpatient_benefits = []
        outpatient_benefits = []
        inpatient_limit = None
        outpatient_limit = None
        deductible_amount = None
        copay_amounts = {}
        
        # Check for section-based format (Dubai: "In-Patient Treatment" section header)
        has_section_headers = bool(re.search(r'In-Patient Treatment.*?Out-Patient(?:\s+&\s+Day-care)?\s+Treatment', full_text, re.DOTALL | re.IGNORECASE))
        
        if has_section_headers:
            # DUBAI FORMAT: Section-based with "In-Patient Treatment" and "Out-Patient Treatment" headers
            print(f"[PDF Parser] Detected DUBAI format (section-based)", file=sys.stderr)
            
            # Extract In-Patient Treatment section (FIXED: better boundary detection)
            inpatient_match = re.search(r'In-Patient Treatment[^\n]*\n(.*?)(?=Out-Patient(?:\s+&\s+Day-care)?\s+Treatment|Exclusions)', full_text, re.DOTALL | re.IGNORECASE)
            if inpatient_match:
                content = inpatient_match.group(1)
                print(f"[PDF Parser] ✓ Found In-Patient section: {len(content)} chars", file=sys.stderr)
                
                # Extract numbered items from this section (FIXED: better pattern for multi-line items)
                items = re.findall(r'(\d+)\.\s+([^\d][^\n]*(?:\n(?!\d+\.\s)[^\n]+)*)', content)
                print(f"[PDF Parser] Found {len(items)} inpatient items", file=sys.stderr)
                
                for item_num, item_text in items:  # Include ALL items (no limit)
                    cleaned = clean_text(item_text)
                    if len(cleaned) > 10:
                        # Extract benefit name (IMPROVED: handle "Name Covered" format better)
                        # Remove trailing numbers that are part of Arabic text
                        cleaned = re.sub(r'\.\d+$', '', cleaned)
                        
                        # Split on "Covered" keyword to get name
                        if ' Covered ' in cleaned or cleaned.endswith(' Covered'):
                            benefit_name = re.split(r'\s+Covered\s+', cleaned, maxsplit=1)[0].strip()
                        elif ' AED ' in cleaned:
                            benefit_name = re.split(r'\s+AED\s+', cleaned, maxsplit=1)[0].strip()
                        else:
                            # Take first line or first 100 chars as name
                            benefit_name = cleaned.split('\n')[0][:100].strip()
                        
                        # Clean up benefit name
                        benefit_name = re.sub(r'\s+', ' ', benefit_name)
                        
                        inpatient_benefits.append({
                            "benefitName": benefit_name,
                            "covered": True if 'covered' in cleaned.lower() else False,
                            "description": cleaned[:600],
                            "coverage": "Covered" if 'covered' in cleaned.lower() else "As per policy"
                        })
            
            # Extract Out-Patient Treatment section (FIXED: handle "Out-Patient & Day-care Treatment" variation)
            outpatient_match = re.search(r'Out-Patient(?:\s+&\s+Day-care)?\s+Treatment[^\n]*\n(.*?)(?=Exclusions|Emergency\s+outside|Pharmacy|Maternity)', full_text, re.DOTALL | re.IGNORECASE)
            if outpatient_match:
                content = outpatient_match.group(1)
                print(f"[PDF Parser] ✓ Found Out-Patient section: {len(content)} chars", file=sys.stderr)
                
                # Extract numbered items (FIXED: better pattern)
                items = re.findall(r'(\d+)\.\s+([^\d][^\n]*(?:\n(?!\d+\.\s)[^\n]+)*)', content)
                print(f"[PDF Parser] Found {len(items)} outpatient items", file=sys.stderr)
                
                for item_num, item_text in items:  # Include ALL items (no limit)
                    cleaned = clean_text(item_text)
                    if len(cleaned) > 10:
                        # Extract benefit name (IMPROVED: handle "Name Covered" format better)
                        cleaned = re.sub(r'\.\d+$', '', cleaned)
                        
                        # Split on "Covered" keyword to get name
                        if ' Covered ' in cleaned or cleaned.endswith(' Covered'):
                            benefit_name = re.split(r'\s+Covered\s+', cleaned, maxsplit=1)[0].strip()
                        elif ' AED ' in cleaned:
                            benefit_name = re.split(r'\s+AED\s+', cleaned, maxsplit=1)[0].strip()
                        elif ' Free ' in cleaned:
                            benefit_name = re.split(r'\s+Free\s+', cleaned, maxsplit=1)[0].strip()
                        else:
                            # Take first line or first 100 chars as name
                            benefit_name = cleaned.split('\n')[0][:100].strip()
                        
                        # Clean up benefit name
                        benefit_name = re.sub(r'\s+', ' ', benefit_name)
                        
                        outpatient_benefits.append({
                            "benefitName": benefit_name,
                            "covered": True if 'covered' in cleaned.lower() or 'free' in cleaned.lower() else False,
                            "description": cleaned[:600],
                            "coverage": "Covered" if 'covered' in cleaned.lower() else "As per policy"
                        })
                        
                        # Extract copay/coinsurance from outpatient items
                        if 'coinsurance' in cleaned.lower() or 'co-payment' in cleaned.lower():
                            copay_match = re.search(r'(\d+)%', cleaned)
                            if copay_match:
                                copay_amounts['opConsultation'] = f"{copay_match.group(1)}% coinsurance"
            
            # Set limits to annual limit for Dubai format (no specific limits in sections)
            if inpatient_benefits:
                inpatient_limit = base_plan_data.get("annualLimit", 0)
            if outpatient_benefits:
                outpatient_limit = base_plan_data.get("annualLimit", 0)
        
        else:
            # ABU DHABI FORMAT: Table-based with numbered items throughout (no section headers)
            print(f"[PDF Parser] Detected ABU DHABI format (table-based)", file=sys.stderr)
            
            # Extract all numbered benefit items from the entire PDF
            benefit_pattern = r'(\d+)\.\s+([^\n]+(?:\n(?!\d+\.)[^\n]+)*)'
            all_benefits = re.findall(benefit_pattern, full_text, re.DOTALL)
            
            print(f"[PDF Parser] Found {len(all_benefits)} numbered benefit items", file=sys.stderr)
            
            for item_num, item_text in all_benefits:
                item_text_cleaned = clean_text(item_text)
                item_lower = item_text_cleaned.lower()
                
                # Extract coverage percentage or amount
                coverage_match = re.search(r'(\d+)%|AED\s*([\d,]+)', item_text_cleaned)
                coverage_value = None
                if coverage_match:
                    if coverage_match.group(1):
                        coverage_value = f"{coverage_match.group(1)}%"
                    elif coverage_match.group(2):
                        coverage_value = f"AED {coverage_match.group(2)}"
                else:
                    coverage_value = "Covered" if "covered" in item_lower else "Not specified"
                
                # Classify as inpatient or outpatient based on keywords
                is_inpatient = any(kw in item_lower for kw in [
                    'in-patient', 'inpatient', 'hospital', 'admission', 'surgery', 
                    'emergency', 'accommodation', 'room', 'bed'
                ])
                is_outpatient = any(kw in item_lower for kw in [
                    'out-patient', 'outpatient', 'consultation', 'clinic', 'doctor visit',
                    'prescription', 'diagnostic', 'laboratory', 'x-ray'
                ])
                
                # Extract benefit name
                benefit_name_match = re.match(r'([^.]+(?:\.|$))', item_text_cleaned)
                benefit_name = benefit_name_match.group(1).strip() if benefit_name_match else item_text_cleaned[:100]
                
                benefit = {
                    "benefitName": benefit_name,
                    "covered": "covered" in item_lower or "100%" in item_text_cleaned,
                    "description": item_text_cleaned[:600],
                    "coverage": coverage_value
                }
                
                if is_inpatient:
                    inpatient_benefits.append(benefit)
                if is_outpatient:
                    outpatient_benefits.append(benefit)
                
                # Extract specific values
                if 'in-patient' in item_lower and re.search(r'AED\s*([\d,]+)', item_text_cleaned):
                    aed_match = re.search(r'AED\s*([\d,]+)', item_text_cleaned)
                    try:
                        value = float(aed_match.group(1).replace(",", ""))
                        if value >= 10000:
                            inpatient_limit = value
                    except:
                        pass
                
                # Copay/Deductible extraction
                if 'out of pocket' in item_lower or 'co-payment' in item_lower:
                    aed_match = re.search(r'AED\s*([\d,]+)', item_text_cleaned)
                    if aed_match:
                        try:
                            value = float(aed_match.group(1).replace(",", ""))
                            if 'encounter' in item_lower:
                                copay_amounts['perEncounter'] = value
                            elif 'annual' in item_lower or 'aggregate' in item_lower:
                                deductible_amount = value
                        except:
                            pass
        
        print(f"[PDF Parser] Classified: {len(inpatient_benefits)} inpatient, {len(outpatient_benefits)} outpatient", file=sys.stderr)
        
        # Add structured categories if we found them
        if "benefits" not in base_plan_data:
            base_plan_data["benefits"] = []
            
        if inpatient_benefits:
            base_plan_data["benefits"].append({
                "categoryId": "inpatient",
                "categoryName": "In-Patient Services",
                "benefits": inpatient_benefits
            })
            print(f"[PDF Parser] ✅ Added {len(inpatient_benefits)} inpatient benefits to plan", file=sys.stderr)
        else:
            print(f"[PDF Parser] ⚠️ No inpatient benefits extracted", file=sys.stderr)
            
        # Set inpatientLimit if extracted from PDF
        if inpatient_limit is not None and inpatient_limit > 0:
            base_plan_data["inpatientLimit"] = inpatient_limit
            print(f"[PDF Parser] ✅ Set inpatientLimit = {inpatient_limit}", file=sys.stderr)
        elif inpatient_benefits and base_plan_data.get("annualLimit"):
            # If we have inpatient benefits but no specific limit, use annual limit
            base_plan_data["inpatientLimit"] = base_plan_data.get("annualLimit", 0)
            print(f"[PDF Parser] ✅ Set inpatientLimit = {base_plan_data['inpatientLimit']} (from annual limit)", file=sys.stderr)
            
        if outpatient_benefits:
            base_plan_data["benefits"].append({
                "categoryId": "outpatient",
                "categoryName": "Out-Patient Services",
                "benefits": outpatient_benefits
            })
            print(f"[PDF Parser] ✅ Added {len(outpatient_benefits)} outpatient benefits to plan", file=sys.stderr)
        else:
            print(f"[PDF Parser] ⚠️ No outpatient benefits extracted", file=sys.stderr)
        
        # Set outpatientLimit if extracted
        if outpatient_limit is not None and outpatient_limit > 0:
            base_plan_data["outpatientLimit"] = outpatient_limit
            print(f"[PDF Parser] ✅ Set outpatientLimit = {outpatient_limit}", file=sys.stderr)
        elif outpatient_benefits and base_plan_data.get("annualLimit"):
            # Default to annual limit if not specified
            base_plan_data["outpatientLimit"] = base_plan_data.get("annualLimit", 0)
            print(f"[PDF Parser] ✅ Set outpatientLimit = {base_plan_data['outpatientLimit']} (from annual limit)", file=sys.stderr)
        
        # Set deductible if found
        if deductible_amount is not None and deductible_amount > 0:
            base_plan_data["deductible"] = deductible_amount
            print(f"[PDF Parser] ✅ Set deductible = {deductible_amount}", file=sys.stderr)
        
        # Set copays if found
        if copay_amounts:
            if "copays" not in base_plan_data:
                base_plan_data["copays"] = {}
            base_plan_data["copays"].update(copay_amounts)
            print(f"[PDF Parser] ✅ Set copays: {copay_amounts}", file=sys.stderr)

        # Extract Alternative Medicine coverage with detailed information (ENHANCED)
        # Looking for: "13. Alternative Medicine Covered - Homeopathy & Ayurveda - AED 2,500 per person per year - 20% coinsurance"
        alt_med_section = None
        alt_med_patterns = [
            # Pattern with section number
            (r'\d+\.\s*Alternative\s+Medicine', 2000),
            # Pattern without section number
            (r'Alternative\s+Medicine[:\s]+', 2000),
            # Pattern looking for specific keywords
            (r'(?:Homeopathy|Ayurveda)[:\s\-]+', 1500),
            # Very flexible pattern - any mention of alternative medicine
            (r'(?i)alternative\s+medicine', 1500),
        ]
        
        for pattern, max_chars in alt_med_patterns:
            alt_med_match = re.search(pattern, full_text, re.IGNORECASE)
            if alt_med_match:
                # Use extract_complete_section to get full section content
                alt_med_section = extract_complete_section(full_text, alt_med_match.start(), max_chars)
                # Make sure we got meaningful content (> 30 chars and contains key info)
                if len(alt_med_section.strip()) > 30:
                    break
        
        # Additional fallback: search for common phrases
        if not alt_med_section or len(alt_med_section) < 50:
            fallback_patterns = [
                r'Homeopathy.*?Ayurveda.*?(?:covered|AED|coinsurance)',
                r'Alternative.*?(?:covered|reimbursement|AED\s*[\d,]+)',
            ]
            for pattern in fallback_patterns:
                fallback_match = re.search(pattern, full_text, re.DOTALL | re.IGNORECASE)
                if fallback_match:
                    # Extract wider context (1000 chars)
                    start_pos = max(0, fallback_match.start() - 50)
                    alt_med_section = extract_complete_section(full_text, start_pos, 1000)
                    if len(alt_med_section.strip()) > 50:
                        break
        
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
                "description": clean_text(alt_med_section[:1500])  # Increased from 200 to 1500
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
                "raw_text": clean_text(alt_med_section[:1500])  # Increased from 300 to 1500
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
                    "description": clean_text(context[:800])  # Increased from 200 to 800
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
        
        # Extract Claims Settlement Basis (ENHANCED - extracts full section)
        # Looking for: "8. Claims Settlement Basis (as per Usual, Customary and Reasonable Charges of the Network in UAE)."
        # "Within the Network on Direct Billing Basis"
        # "Outside the Network on Reimbursement Basis"
        claims_settlement_section = None
        claims_settlement_patterns = [
            # Pattern with section number
            (r'\d+\.\s*Claims\s+Settlement\s+Basis', 2000),
            # Pattern without section number
            (r'Claims\s+Settlement\s+Basis[:\s\(]', 2000),
            # Pattern looking for key terms
            (r'Settlement\s+Basis.*?(?:Direct\s+Billing|Reimbursement)', 1500),
        ]
        
        for pattern, max_chars in claims_settlement_patterns:
            claims_match = re.search(pattern, full_text, re.IGNORECASE)
            if claims_match:
                # Use extract_complete_section to get full section content
                claims_settlement_section = extract_complete_section(full_text, claims_match.start(), max_chars)
                # Make sure we got meaningful content
                if len(claims_settlement_section.strip()) > 50:
                    break
        
        # Additional fallback: search for Direct Billing + Reimbursement together
        if not claims_settlement_section or len(claims_settlement_section) < 80:
            fallback_match = re.search(r'(?:Direct\s+Billing|Within.*?Network).*?(?:Reimbursement|Outside.*?Network)', full_text, re.DOTALL | re.IGNORECASE)
            if fallback_match:
                # Extract wider context
                start_pos = max(0, fallback_match.start() - 100)
                claims_settlement_section = extract_complete_section(full_text, start_pos, 1500)
        
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
                "description": clean_text(claims_settlement_section[:1500])  # Increased from 200 to 1500
            }
            
            # Also store in rawPlanData for reference
            if "rawPlanData" not in base_plan_data:
                base_plan_data["rawPlanData"] = {}
            base_plan_data["rawPlanData"]["claims_settlement_basis"] = {
                "direct_billing_within_network": has_direct_billing,
                "reimbursement_outside_network": has_reimbursement,
                "uses_ucr": has_ucr,
                "raw_text": clean_text(claims_settlement_section[:1500])  # Increased from 300 to 1500
            }
        
        # Extract Physiotherapy coverage (ENHANCED - gets full description)
        physio_section = None
        physio_patterns = [
            (r'Physiotherapy[:\s\-]+', 1000),  # Look for "Physiotherapy:" or "Physiotherapy -"
            (r'\d+\s+sessions.*?physiotherapy', 800),  # Look for "20 sessions ... physiotherapy"
            (r'physiotherapy.*?treatment', 800),  # Look for "physiotherapy ... treatment"
        ]
        
        for pattern, max_chars in physio_patterns:
            physio_match = re.search(pattern, full_text, re.IGNORECASE)
            if physio_match:
                # Extract complete description (don't truncate at first comma)
                physio_section = extract_complete_section(full_text, physio_match.start(), max_chars)
                if len(physio_section.strip()) > 20:
                    physio_value = clean_text(physio_section)
                    if physio_value and validate_text_quality(physio_value, "physiotherapy"):
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
        # Log error but don't crash
        print(f"[PDF Parser] ❌ ERROR: {e}", file=sys.stderr)
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
