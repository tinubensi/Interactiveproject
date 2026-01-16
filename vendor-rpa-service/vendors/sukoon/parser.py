"""
Sukoon Insurance Data Parser
Helper functions for cleaning and parsing Sukoon plan data
"""
import re
from typing import Optional, Union


def clean_number(value: str) -> Optional[float]:
    """
    Clean and parse a number string, removing commas and converting to float
    
    Args:
        value: String like "11,609.26" or "5,000,000"
        
    Returns:
        Float value or None if parsing fails
    """
    if not value or not isinstance(value, str):
        return None
    
    try:
        # Remove commas and any non-numeric characters except decimal point
        cleaned = re.sub(r'[^\d.]', '', value)
        return float(cleaned) if cleaned else None
    except (ValueError, AttributeError):
        return None


def parse_coverage(value: str) -> Optional[float]:
    """
    Parse coverage amount from string like "5,000,000" to float
    
    Args:
        value: Coverage amount string
        
    Returns:
        Float value or None if parsing fails
    """
    return clean_number(value)


def parse_benefit(value: str) -> Union[float, str, None]:
    """
    Parse benefit values with special handling for X/✔ symbols
    
    Args:
        value: Benefit value (could be amount, "X", "✔", etc.)
        
    Returns:
        Parsed value (float, boolean indicator, or original string)
    """
    if not value or not isinstance(value, str):
        return None
    
    value = value.strip()
    
    # Handle special markers
    if value in ['X', '✘', 'x']:
        return 0.0  # Not covered
    if value in ['✔', '✓', 'Yes']:
        return None  # Covered but amount not specified
    
    # Try to parse as number
    numeric = clean_number(value)
    if numeric is not None:
        return numeric
    
    # Return original string if can't parse
    return value


def parse_premium(value: str) -> Optional[float]:
    """
    Parse premium value from string
    
    Args:
        value: Premium string like "11,609.26"
        
    Returns:
        Float value or None if parsing fails
    """
    return clean_number(value)


def parse_plan_name(plan_name: str) -> str:
    """
    Normalize plan name
    
    Args:
        plan_name: Raw plan name like "Sukoon HealthPlus - PRIME"
        
    Returns:
        Cleaned plan name
    """
    if not plan_name:
        return "Unknown Plan"
    
    # Already formatted correctly
    if "Sukoon HealthPlus" in plan_name:
        return plan_name
    
    # Add prefix if missing
    return f"Sukoon HealthPlus - {plan_name}"


def extract_network_type(details: dict) -> Optional[str]:
    """
    Extract network type from plan details
    
    Args:
        details: Plan details dictionary
        
    Returns:
        Network type string or None
    """
    for key in ['Network', 'NETWORK', 'network']:
        if key in details:
            return details[key]
    return None


def extract_aggregate_limit(details: dict) -> Optional[float]:
    """
    Extract aggregate limit (coverage amount) from plan details
    
    Args:
        details: Plan details dictionary
        
    Returns:
        Aggregate limit as float or None
    """
    for key in ['Aggregate Limit', 'AGGREGATE LIMIT', 'Coverage', 'COVERAGE']:
        if key in details:
            return parse_coverage(details[key])
    return None
