"""
Vendor Configuration Loader
Loads vendor list from configuration files
"""
import json
import os
from typing import List, Dict, Optional
from pathlib import Path

# Cache for vendor list
_vendor_cache = {}


def load_vendor_list(line_of_business: Optional[str] = None) -> List[Dict]:
    """
    Load vendor list from configuration
    
    Args:
        line_of_business: Filter by LOB (Medical, Motor, etc.)
    
    Returns:
        List of vendor configurations
    """
    global _vendor_cache
    
    # Check cache
    cache_key = line_of_business or "all"
    if cache_key in _vendor_cache:
        return _vendor_cache[cache_key]
    
    # Load from file
    config_path = Path(__file__).parent.parent / "vendors" / "vendor_list.json"
    
    if not config_path.exists():
        # Return default list if file doesn't exist
        return get_default_vendor_list(line_of_business)
    
    with open(config_path, 'r') as f:
        vendor_config = json.load(f)
    
    # Filter by LOB if specified
    if line_of_business:
        lob_key = line_of_business.lower()
        vendors = vendor_config.get(lob_key, [])
    else:
        # Return all vendors from all LOBs
        vendors = []
        for lob_vendors in vendor_config.values():
            vendors.extend(lob_vendors)
    
    # Cache result
    _vendor_cache[cache_key] = vendors
    
    return vendors


def get_default_vendor_list(line_of_business: Optional[str] = None) -> List[Dict]:
    """
    Default vendor list (fallback)
    """
    default_vendors = {
        "medical": [
            {
                "id": "watania",
                "name": "Watania Takaful",
                "enabled": True,
                "portalUrl": "https://www.watania.ae/",
                "requiresAuth": True,
                "timeout": 90,
                "priority": 5
            },
            {
                "id": "nextcare",
                "name": "NextCare",
                "enabled": True,
                "portalUrl": "https://nextcare.ae/",
                "requiresAuth": False,
                "timeout": 90,
                "priority": 5
            },
            {
                "id": "daman",
                "name": "Daman",
                "enabled": True,
                "portalUrl": "https://www.damanhealth.ae/",
                "requiresAuth": False,
                "timeout": 90,
                "priority": 5
            }
        ],
        "motor": [
            {
                "id": "oman_insurance",
                "name": "Oman Insurance",
                "enabled": True,
                "portalUrl": "https://www.omaninsurance.ae/",
                "requiresAuth": False,
                "timeout": 90,
                "priority": 5
            }
        ]
    }
    
    if line_of_business:
        lob_key = line_of_business.lower()
        return default_vendors.get(lob_key, [])
    
    # Return all
    all_vendors = []
    for vendors in default_vendors.values():
        all_vendors.extend(vendors)
    return all_vendors


def reload_vendor_list():
    """Reload vendor list from file (clear cache)"""
    global _vendor_cache
    _vendor_cache = {}

