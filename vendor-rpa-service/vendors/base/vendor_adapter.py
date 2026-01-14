"""
Base Vendor Adapter
Abstract base class for vendor-specific data transformations
"""
from abc import ABC, abstractmethod
from typing import Dict, Any, List
import re
from uuid import uuid4
from datetime import datetime


class VendorAdapter(ABC):
    """
    Abstract base class for vendor-specific data adapters.
    
    Responsibilities:
    1. Transform StandardLead to vendor-specific payload (prepare_vendor_payload)
    2. Transform raw vendor response to StandardPlan (normalize_response)
    """
    
    def __init__(self, vendor_id: str, vendor_name: str):
        self.vendor_id = vendor_id
        self.vendor_name = vendor_name
    
    @abstractmethod
    def prepare_vendor_payload(self, standard_lead: Dict[str, Any]) -> Dict[str, Any]:
        """
        Transform StandardLead into vendor-specific payload format.
        
        This method handles input adaptation - converting our clean StandardLead
        format into whatever messy format the vendor portal expects.
        
        Args:
            standard_lead: Clean StandardLead dictionary
        
        Returns:
            Vendor-specific payload dictionary
        """
        pass
    
    @abstractmethod
    def normalize_response(self, raw_vendor_data: Dict[str, Any], lead_id: str) -> List[Dict[str, Any]]:
        """
        Transform raw vendor data into StandardPlan format.
        
        This method handles output adaptation - converting the vendor's messy
        response into our clean StandardPlan format.
        
        Args:
            raw_vendor_data: Raw data scraped from vendor portal
            lead_id: Lead ID to associate plans with
        
        Returns:
            List of StandardPlan dictionaries
        """
        pass
    
    def _create_standard_plan(
        self,
        lead_id: str,
        plan_details: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Helper method to create a StandardPlan dictionary.
        
        Args:
            lead_id: Lead ID
            plan_details: Plan-specific fields
        
        Returns:
            Complete StandardPlan dictionary
        """
        return {
            "id": str(uuid4()),
            "leadId": lead_id,
            "vendorId": self.vendor_id,
            "vendorName": self.vendor_name,
            "planName": plan_details.get("planName", "Unknown Plan"),
            "planCode": plan_details.get("planCode"),
            "planType": plan_details.get("planType"),
            "annualPremium": plan_details.get("annualPremium", 0.0),
            "monthlyPremium": plan_details.get("monthlyPremium"),
            "currency": plan_details.get("currency", "AED"),
            "coverageAmount": plan_details.get("coverageAmount", 0.0),
            "deductible": plan_details.get("deductible"),
            "coInsurance": plan_details.get("coInsurance"),
            "waitingPeriod": plan_details.get("waitingPeriod"),
            "benefits": plan_details.get("benefits", []),
            "exclusions": plan_details.get("exclusions", []),
            "fetchedAt": datetime.now().isoformat(),
            "rawData": plan_details.get("rawData", {})
        }
    
    def _clean_and_parse_number(self, value: Any) -> float:
        """
        Clean a string by removing non-numeric characters and parse to float.
        
        Examples:
            "AED 1,234.56" -> 1234.56
            "$ 5,000" -> 5000.0
            "10%" -> 10.0
        
        Args:
            value: String or number to clean
        
        Returns:
            Cleaned float value
        """
        if value is None:
            return 0.0
        
        if isinstance(value, (int, float)):
            return float(value)
        
        # Remove all non-numeric characters except decimal point and minus sign
        cleaned = re.sub(r'[^\d.-]+', '', str(value))
        
        try:
            return float(cleaned)
        except ValueError:
            return 0.0
    
    def _clean_text(self, text: Any) -> str:
        """
        Clean text by removing extra whitespace and normalizing.
        
        Args:
            text: Text to clean
        
        Returns:
            Cleaned text
        """
        if text is None:
            return ""
        
        # Convert to string and strip
        text = str(text).strip()
        
        # Replace multiple spaces with single space
        text = re.sub(r'\s+', ' ', text)
        
        return text
    
    def _format_date(self, date_str: str, input_format: str = None, output_format: str = "%Y-%m-%d") -> str:
        """
        Format date string.
        
        Args:
            date_str: Input date string
            input_format: Input format (e.g., "%d/%m/%Y")
            output_format: Output format (default ISO format)
        
        Returns:
            Formatted date string
        """
        from datetime import datetime
        
        if not date_str:
            return ""
        
        try:
            if input_format:
                dt = datetime.strptime(date_str, input_format)
            else:
                # Try to parse common formats
                for fmt in ["%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"]:
                    try:
                        dt = datetime.strptime(date_str, fmt)
                        break
                    except ValueError:
                        continue
                else:
                    return date_str  # Return as-is if can't parse
            
            return dt.strftime(output_format)
        except Exception:
            return date_str
    
    def _extract_phone_number(self, phone) -> str:
        """
        Extract phone number from phone dictionary or string.
        
        Args:
            phone: Phone dictionary with countryCode, number, isoCode OR phone string
        
        Returns:
            Formatted phone number
        """
        if not phone:
            return ""
        
        # Handle string format (e.g., "+971501234567")
        if isinstance(phone, str):
            # Remove common country codes and clean the number
            number = phone.strip()
            # Remove + and country code prefix
            if number.startswith('+'):
                number = number[1:]
            # Remove common UAE country code
            if number.startswith('971'):
                number = number[3:]
            return number.lstrip()
        
        # Handle dictionary format
        # Get number without country code
        number = phone.get('number', '')
        country_code = phone.get('countryCode', '')
        
        # Remove country code from number if present
        if country_code and number.startswith(country_code):
            number = number[len(country_code):].lstrip()
        
        return number
    
    def _parse_waiting_period(self, text: str) -> int:
        """
        Parse waiting period from text to days.
        
        Examples:
            "30 days" -> 30
            "2 months" -> 60
            "1 year" -> 365
        
        Args:
            text: Waiting period text
        
        Returns:
            Waiting period in days
        """
        if not text:
            return 0
        
        text = text.lower()
        
        # Extract number
        match = re.search(r'(\d+)', text)
        if not match:
            return 0
        
        value = int(match.group(1))
        
        # Convert to days based on unit
        if 'month' in text:
            return value * 30
        elif 'year' in text:
            return value * 365
        elif 'week' in text:
            return value * 7
        else:  # Assume days
            return value

