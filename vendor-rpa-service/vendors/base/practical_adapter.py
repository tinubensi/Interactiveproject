"""
Base Practical Adapter
Provides common utilities for all vendor adapters
Implements practical data transformation helpers
"""
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional


class BasePracticalAdapter:
    """
    Base class for vendor adapters with practical utility methods
    Handles common data extraction and transformation tasks
    """
    
    def __init__(self, vendor_id: str, vendor_name: str, vendor_code: str):
        """
        Initialize base adapter
        
        Args:
            vendor_id: Vendor identifier (e.g., 'takaful', 'watania')
            vendor_name: Vendor display name (e.g., 'Takaful Emarat')
            vendor_code: Vendor code (e.g., 'TKF', 'WTN')
        """
        self.vendor_id = vendor_id
        self.vendor_name = vendor_name
        self.vendor_code = vendor_code
    
    def safe_extract_number(self, value: Any, fallback: float = 0) -> float:
        """
        Safely extract number from various input formats
        
        Args:
            value: Input value (int, float, str, or None)
            fallback: Value to return if extraction fails
        
        Returns:
            Extracted number or fallback
        
        Examples:
            >>> adapter.safe_extract_number(1000)
            1000
            >>> adapter.safe_extract_number("AED 1,500.50")
            1500.50
            >>> adapter.safe_extract_number("75,000 + VAT")
            75000
            >>> adapter.safe_extract_number(None, 0)
            0
        """
        if value is None:
            return fallback
        
        if isinstance(value, (int, float)):
            return float(value)
        
        if isinstance(value, str):
            # Remove currency symbols, commas, and extra text
            # Extract first number found
            cleaned = re.sub(r'[^\d.,]', '', value)
            if not cleaned:
                return fallback
            
            # Handle comma as thousands separator
            cleaned = cleaned.replace(',', '')
            
            try:
                return float(cleaned)
            except ValueError:
                return fallback
        
        return fallback
    
    def determine_plan_type(self, premium: float) -> str:
        """
        Determine plan tier based on annual premium
        
        Args:
            premium: Annual premium amount
        
        Returns:
            Plan type ('bronze', 'silver', 'gold', 'platinum')
        """
        if premium >= 15000:
            return "platinum"
        elif premium >= 10000:
            return "gold"
        elif premium >= 5000:
            return "silver"
        else:
            return "bronze"
    
    def create_base_plan(self, lead_id: str) -> Dict[str, Any]:
        """
        Create base plan dictionary with all required defaults
        
        Args:
            lead_id: Lead ID to associate plan with
        
        Returns:
            Dictionary with base plan structure and defaults
        """
        return {
            "id": f"plan-{uuid.uuid4()}",
            "leadId": lead_id,
            "vendorId": self.vendor_id,
            "vendorName": self.vendor_name,
            "vendorCode": self.vendor_code,
            "currency": "AED",
            "lineOfBusiness": "medical",
            "source": "rpa",
            "fetchedAt": datetime.now().isoformat(),
            "isAvailable": True,
            "isSelected": False,
            "isRecommended": False,
            "benefits": [],
            "exclusions": [],
            "fetchRequestId": ""
        }
    
    def generate_plan_code(self, plan_name: str) -> str:
        """
        Generate plan code from plan name
        
        Args:
            plan_name: Full plan name
        
        Returns:
            Generated plan code (e.g., 'TKF-GOL-PLA')
        
        Examples:
            >>> adapter.generate_plan_code("Gold Plan")
            'TKF-GOL-PLA'
            >>> adapter.generate_plan_code("Class A NE1 (0-45)")
            'TKF-CLA-A-NE1'
        """
        # Remove parentheses content
        name = re.sub(r'\([^)]*\)', '', plan_name)
        
        # Split into words, take first 3-4 meaningful parts
        parts = [p for p in name.split() if len(p) > 0][:4]
        
        # Take first 3 letters of each part, uppercase
        code_parts = [p[:3].upper() for p in parts if p.isalnum() or p.isalpha()]
        
        if not code_parts:
            # Fallback to vendor code only
            return f"{self.vendor_code}-UNK"
        
        return f"{self.vendor_code}-{'-'.join(code_parts)}"
    
    def extract_limit_from_text(self, text: str, keywords: List[str]) -> Optional[float]:
        """
        Extract coverage limit from text using keywords
        
        Args:
            text: Text to search in
            keywords: List of keywords to match (case-insensitive)
        
        Returns:
            Extracted limit or None if not found
        
        Examples:
            >>> adapter.extract_limit_from_text("Inpatient up to AED 500,000", ["inpatient"])
            500000
        """
        if not text:
            return None
        
        text_lower = text.lower()
        
        # Check if any keyword matches
        if not any(kw.lower() in text_lower for kw in keywords):
            return None
        
        # Extract number with AED currency
        match = re.search(r'AED\s*([\d,]+(?:\.\d+)?)', text, re.IGNORECASE)
        if match:
            number_str = match.group(1).replace(',', '')
            try:
                return float(number_str)
            except ValueError:
                pass
        
        return None
    
    def clean_text(self, text: Any) -> str:
        """
        Clean text by removing Arabic characters, special chars, and normalizing whitespace
        
        Args:
            text: Text to clean
        
        Returns:
            Cleaned text
        """
        if text is None or text == '':
            return ''
        
        text = str(text)
        
        # Remove Unicode replacement character (replace with space to preserve words)
        text = text.replace('\ufffd', ' ')
        text = text.replace('�', ' ')
        
        # Remove Arabic characters (Unicode ranges)
        text = re.sub(r'[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]+', ' ', text)
        
        # Remove other non-printable characters (replace with space)
        text = re.sub(r'[\x00-\x1F\x7F-\x9F]+', ' ', text)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()
        
        return text
