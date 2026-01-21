"""
Sukoon Insurance Plan Scraper
Extracts plan information from Sukoon portal
"""
import re
from datetime import datetime
from typing import List, Dict, Any
from playwright.async_api import Page
from vendors.sukoon.benefits_enricher import enrich_multiple_plans


class SukoonScraper:
    """
    Scraper for extracting plan data from Sukoon portal
    Adapted from standalone sukoon_bot.py lines 214-357
    """
    
    def __init__(self, page: Page, config: Dict[str, Any], vendor_payload: Dict[str, Any]):
        """
        Initialize the Sukoon scraper
        
        Args:
            page: Playwright page object
            config: Bot configuration
            vendor_payload: Vendor-specific payload data
        """
        self.page = page
        self.config = config
        self.vendor_payload = vendor_payload
        self.plan_names = ['PRIME', 'PRO', 'MAX', 'HOME', 'HOME LITE', 'SAFE']
    
    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        """
        Extract all plans from the results page
        
        Returns:
            List of dictionaries containing raw plan data
        """
        try:
            # Wait for results to load
            await self.page.wait_for_timeout(2000)
            
            plan_data = {
                'extraction_time': datetime.now().isoformat(),
                'plans': [],
                'plan_details': {}
            }
            
            # First, try to extract premiums from the header section
            try:
                # Look for elements containing "INDICATIVE PREMIUM" text
                premium_label = self.page.locator('text=/INDICATIVE PREMIUM/i')
                if await premium_label.count() > 0:
                    # Get the parent row/container
                    premium_container = premium_label.locator('..').locator('..')
                    
                    # Extract all numeric values that look like premiums
                    container_text = await premium_container.text_content()
                    premium_values = re.findall(r'[\d,]+\.\d{2}', container_text)
                    
                    if len(premium_values) >= 6:
                        premiums = {}
                        for idx, plan_name in enumerate(self.plan_names):
                            if idx < len(premium_values):
                                premiums[plan_name] = premium_values[idx]
                        
                        if premiums:
                            plan_data['plan_details']['INDICATIVE PREMIUM'] = premiums
            except Exception as e:
                # Continue if premium extraction from header fails
                pass
            
            # Try to find all table rows in the plan details section
            table_rows = self.page.locator('table tr, [class*="table"] tr')
            row_count = await table_rows.count()
            
            # Extract data from each row
            for row_idx in range(row_count):
                try:
                    row = table_rows.nth(row_idx)
                    cells = row.locator('td, th')
                    cell_count = await cells.count()
                    
                    if cell_count > 1:  # Has multiple cells
                        # First cell is usually the row label
                        first_cell = cells.first
                        row_label = (await first_cell.text_content()).strip()
                        
                        # Skip empty rows, header rows, calendar data, and irrelevant labels
                        if (not row_label or len(row_label) < 2 or 
                            row_label in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] or
                            row_label.isdigit() or
                            row_label in ['ID', '✔', 'X', '✔  Covered    X Not Covered']):
                            continue
                        
                        # Extract values for each plan
                        row_data = []
                        for cell_idx in range(1, min(cell_count, 7)):  # Get first 6 plan columns
                            try:
                                cell = cells.nth(cell_idx)
                                cell_value = (await cell.text_content()).strip()
                                row_data.append(cell_value)
                            except:
                                row_data.append('')
                        
                        # Store the row data
                        if row_data and any(row_data):  # Has at least one non-empty value
                            plan_data['plan_details'][row_label] = {}
                            for idx, plan_name in enumerate(self.plan_names):
                                if idx < len(row_data):
                                    plan_data['plan_details'][row_label][plan_name] = row_data[idx]
                
                except Exception:
                    continue
            
            # Create structured plan summaries
            for plan_name in self.plan_names:
                plan_info = {
                    'plan_name': f'Sukoon HealthPlus - {plan_name}',
                    'vendor_id': 'vendor-sukoon',
                    'premium': None,
                    'details': {}
                }
                
                for detail_key, plan_values in plan_data['plan_details'].items():
                    if plan_name in plan_values:
                        value = plan_values[plan_name]
                        plan_info['details'][detail_key] = value
                        
                        # Extract premium to top level for easy access
                        if 'PREMIUM' in detail_key.upper():
                            plan_info['premium'] = value
                
                if plan_info['details']:
                    plan_data['plans'].append(plan_info)
            
            # Enrich plans with static DXB benefits data before returning
            enriched_plans = enrich_multiple_plans(plan_data['plans'])
            
            return enriched_plans
        
        except Exception as e:
            raise Exception(f"Error extracting plans: {e}")
