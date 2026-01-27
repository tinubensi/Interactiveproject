"""
Sukoon Benefits Enricher Module

Enriches plans scraped from the portal with static DXB benefits data.
Matches plans by name and intelligently merges benefit information.
"""

from typing import Dict, Any, Optional, List
from vendors.sukoon.benefits_data import get_benefits_for_plan, normalize_plan_name
import copy


def enrich_plan_with_benefits(plan: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a portal plan with static DXB benefits data.
    
    Matches the plan by normalized name and merges comprehensive
    benefit information into the plan's details dictionary.
    
    Args:
        plan: Portal plan dictionary with plan_name and details
        
    Returns:
        Enriched plan dictionary with merged benefits
    """
    if not plan or not isinstance(plan, dict):
        return plan
    
    # Get plan name
    plan_name = plan.get('plan_name')
    if not plan_name:
        return plan
    
    # Get matching benefits
    benefits = get_benefits_for_plan(plan_name)
    if not benefits:
        # No matching benefits found, return plan unchanged
        return plan
    
    # Create a copy to avoid mutating the original
    enriched_plan = copy.deepcopy(plan)
    
    # Merge benefits into plan details
    if 'details' not in enriched_plan:
        enriched_plan['details'] = {}
    
    enriched_plan['details'] = merge_benefit_sections(
        enriched_plan['details'],
        benefits
    )
    
    return enriched_plan


def merge_benefit_sections(existing_details: Dict[str, Any], benefit_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Intelligently merge benefit sections into existing plan details.
    
    Preserves existing portal data (like premium, network) and adds
    comprehensive benefit information from static data.
    
    Args:
        existing_details: Existing plan details from portal
        benefit_data: Static benefits data from DXB plans
        
    Returns:
        Merged details dictionary
    """
    if not isinstance(existing_details, dict):
        existing_details = {}
    
    if not isinstance(benefit_data, dict):
        return existing_details
    
    # Create result starting with existing details
    merged = copy.deepcopy(existing_details)
    
    # Benefit sections to merge (arrays from JSON)
    benefit_sections = [
        'outPatient',
        'inPatient',
        'maternity',
        'preExistingMedicalCondition',
        'otherBenefits',
        'basisClaim'
    ]
    
    # Add benefit arrays as they are (will be processed by adapter)
    for section in benefit_sections:
        if section in benefit_data:
            merged[section] = benefit_data[section]
    
    # Add metadata fields (only if not already present to avoid overwriting portal data)
    metadata_fields = {
        'area': 'Area',
        'copayForTest': 'Co-pay for Tests',
        'copayForConsultation': 'Co-pay for Consultation',
        'inpatientnetworkProvider': 'Inpatient Network',
        'outpatientnetworkProvider': 'Outpatient Network'
    }
    
    for field, display_name in metadata_fields.items():
        if field in benefit_data and field not in merged:
            merged[field] = benefit_data[field]
    
    # Add boolean flags as detail entries
    if 'dental' in benefit_data:
        merged['Dental Coverage'] = 'Yes' if benefit_data['dental'] else 'No'
    
    if 'optical' in benefit_data:
        merged['Optical Coverage'] = 'Yes' if benefit_data['optical'] else 'No'
    
    if 'wellness' in benefit_data:
        merged['Wellness Coverage'] = 'Yes' if benefit_data['wellness'] else 'No'
    
    # Add coverage amount if not present (don't overwrite AGGREGATE LIMIT from portal)
    if 'amount' in benefit_data and 'AGGREGATE LIMIT' not in merged:
        merged['Coverage Amount'] = str(benefit_data['amount'])
    
    return merged


def enrich_multiple_plans(plans: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Enrich multiple plans with benefits data.
    
    Args:
        plans: List of portal plan dictionaries
        
    Returns:
        List of enriched plans
    """
    if not isinstance(plans, list):
        return plans
    
    return [enrich_plan_with_benefits(plan) for plan in plans]
