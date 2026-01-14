"""
Vendor Loader - Load vendor configurations based on Line of Business
"""
import json
import os
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)


def get_vendors_for_lob(lob: str) -> List[Dict]:
    """
    Get list of enabled vendors for a specific Line of Business
    
    Args:
        lob: Line of Business (e.g., "medical", "motor")
        
    Returns:
        List of vendor dictionaries with id, name, and priority
    """
    try:
        # Load vendor list from JSON file
        vendor_list_path = os.path.join(
            os.path.dirname(os.path.dirname(__file__)),
            'vendors',
            'vendor_list.json'
        )
        
        logger.info(f'Loading vendor list from: {vendor_list_path}')
        
        if not os.path.exists(vendor_list_path):
            logger.error(f'Vendor list file not found: {vendor_list_path}')
            return []
        
        with open(vendor_list_path, 'r') as f:
            vendor_list = json.load(f)
        
        # Get vendors for this LOB (array format)
        lob_vendors = vendor_list.get(lob, [])
        
        if not lob_vendors:
            logger.warning(f'No vendors configured for LOB: {lob}')
            return []
        
        # Filter enabled vendors
        vendors = []
        for vendor_config in lob_vendors:
            if vendor_config.get('enabled', False):
                vendors.append({
                    'id': vendor_config.get('id'),
                    'name': vendor_config.get('name'),
                    'priority': vendor_config.get('priority', 1)
                })
        
        # Sort by priority (lower number = higher priority)
        vendors.sort(key=lambda v: v['priority'])
        
        logger.info(f'Found {len(vendors)} enabled vendors for LOB {lob}')
        
        return vendors
        
    except Exception as e:
        logger.error(f'Error loading vendors for LOB {lob}: {str(e)}', exc_info=True)
        return []
