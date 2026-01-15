"""
Takaful Plan Scraper Module
Handles extraction of insurance plan details from Takaful portal including table parsing
"""
import asyncio
import re
import time
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from vendors.base.utils import clean_text, setup_logging
from vendors.takaful.parser import TakafulDataParser


class TakafulScraper:
    """
    Scraper class for extracting Takaful insurance plan details
    Handles transposed table parsing (columns = plans, rows = attributes)
    """
    
    def __init__(self, page: Page, config: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None):
        """
        Initialize the Takaful Scraper
        
        Args:
            page: Playwright page object
            config: Optional configuration dictionary
            form_data: Optional form data for context
        """
        self.page = page
        self.config = config or {}
        self.form_data = form_data
        self.logger = setup_logging(self.config.get('log_level', 'INFO'))
        self.parser = TakafulDataParser()
    
    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        """
        Extract all insurance plans from the comparison modal
        
        Args:
            bot: TakafulBot instance for navigation
        
        Returns:
            List of structured plan dictionaries in StandardPlan format
        """
        self.logger.info("🚀 Starting Takaful plan extraction...")
        
        structured_plans = []
        
        try:
            # Step 1: Wait for modal to appear
            self.logger.info("⏳ Waiting for comparison modal to load...")
            try:
                await self.page.wait_for_selector("#pdfData", timeout=10000, state="visible")
                self.logger.info("✓ Modal loaded")
                await asyncio.sleep(2)  # Extra wait for content to stabilize
            except Exception as e:
                self.logger.warning(f"⚠ Modal not found: {e}")
                await asyncio.sleep(3)
            
            # Step 2: Check for "Show more" button and click it
            self.logger.info("🔍 Checking for 'Show more' button...")
            try:
                show_more_button = self.page.locator("#pdfData").get_by_text("Show more", exact=False)
                if await show_more_button.is_visible(timeout=2000):
                    self.logger.info("  Clicking 'Show more' to load all plans...")
                    await show_more_button.click()
                    await asyncio.sleep(2)
                    self.logger.info("✓ All plans loaded")
            except Exception as e:
                self.logger.debug(f"  No 'Show more' button (this is normal): {e}")
            
            # Step 3: Scroll within modal to ensure all content is loaded
            self.logger.info("🔄 Scrolling within modal to load lazy content...")
            try:
                scroll_result = await self.page.evaluate("""
                    () => {
                        const modal = document.querySelector('#pdfData .modal-body');
                        if (modal) {
                            const initialHeight = modal.scrollHeight;
                            modal.scrollTo(0, modal.scrollHeight);
                            return {success: true, height: initialHeight};
                        }
                        return {success: false};
                    }
                """)
                if scroll_result.get('success'):
                    await asyncio.sleep(2)
                    self.logger.info(f"✓ Modal scrolled (height: {scroll_result.get('height')}px)")
            except Exception as e:
                self.logger.debug(f"  Could not scroll modal: {e}")
            
            # Step 4: Extract table structure - TRANSPOSED TABLE PARSING
            self.logger.info("📋 Parsing table structure (columns = plans, rows = attributes)...")
            
            # Find all table rows in the modal
            table_rows = await self.page.query_selector_all("#pdfData tr")
            
            if not table_rows:
                # Fallback: try without #pdfData prefix
                table_rows = await self.page.query_selector_all("tr.ng-star-inserted")
            
            self.logger.info(f"  Found {len(table_rows)} table rows")
            
            # Dictionary to store: {attribute_name: [plan1_value, plan2_value, ...]}
            attributes_by_column = {}
            num_plans = 0
            
            for row_idx, row in enumerate(table_rows):
                try:
                    # Get all cells in this row
                    cells = await row.query_selector_all("td")
                    
                    if len(cells) < 2:
                        # Skip rows with less than 2 cells (header row or empty)
                        continue
                    
                    # First cell is the attribute name/header
                    header_cell = cells[0]
                    header_text = await header_cell.inner_text()
                    header_text = header_text.strip()
                    
                    # Skip empty headers
                    if not header_text or len(header_text) < 2:
                        continue
                    
                    # Remaining cells are plan values
                    plan_values = []
                    for cell in cells[1:]:
                        cell_text = await cell.inner_text()
                        plan_values.append(cell_text.strip())
                    
                    # Store in our structure
                    if plan_values:
                        attributes_by_column[header_text] = plan_values
                        # Track the maximum number of plans
                        num_plans = max(num_plans, len(plan_values))
                
                except Exception as e:
                    self.logger.warning(f"  Warning: Could not parse row {row_idx}: {e}")
                    continue
            
            self.logger.info(f"✓ Parsed {len(attributes_by_column)} attributes for {num_plans} plans")
            
            # Step 5: Transpose - Convert column-based data to individual plan objects
            self.logger.info(f"🔄 Transposing data to {num_plans} individual plan objects...")
            
            raw_plans = []
            for plan_idx in range(num_plans):
                try:
                    # Build coverage_details for this plan
                    coverage_details = {}
                    
                    for attr_name, values in attributes_by_column.items():
                        if plan_idx < len(values):
                            coverage_details[attr_name] = values[plan_idx]
                    
                    # Extract key fields for top-level access
                    premium_text = coverage_details.get("Premium", "") or coverage_details.get("Price", "")
                    premium_match = re.search(r'AED\s*(\d+[,\d]*)', premium_text)
                    premium = f"AED {premium_match.group(1)} + VAT" if premium_match else premium_text or "Contact for pricing"
                    
                    # Extract plan name from various fields
                    plan_name = (
                        coverage_details.get("Plan Name", "") or
                        coverage_details.get("Plan", "") or
                        coverage_details.get("Product", "") or
                        f"Plan {plan_idx + 1}"
                    )
                    
                    # Clean plan name if it's too long
                    if len(plan_name) > 50:
                        # Try to extract just the plan type
                        name_match = re.search(
                            r'(BLUE\s*\d*|SILVER\s+(?:CLASSIC|PREMIUM|GOLD)|GOLD\s*\w*|GREEN|SILKROAD|BRONZE\s*\w*|CLASSIC)',
                            plan_name,
                            re.IGNORECASE
                        )
                        if name_match:
                            plan_name = name_match.group(1).strip()
                    
                    # Extract TPA
                    tpa = coverage_details.get("TPA", "Standard")
                    if not tpa or tpa == "Standard":
                        # Try to find TPA name in any field
                        for key, value in coverage_details.items():
                            for tpa_name in ["E-Care", "E CARE", "MedNet", "Nextcare", "NAS", "Aafiya"]:
                                if tpa_name.lower() in str(value).lower():
                                    tpa = tpa_name
                                    break
                    
                    # Extract Network
                    network = coverage_details.get("Network", "Standard Network")
                    if len(network) > 50:
                        network = network[:47] + "..."
                    
                    # Extract Co-pay
                    copay_text = coverage_details.get("Co-pay", "") or coverage_details.get("Co-pay Consultation Pharmacy Diagnostic", "")
                    copay_match = re.search(r'(\d+)\s*%', str(copay_text))
                    copay = f"{copay_match.group(1)}%" if copay_match else "N/A"
                    
                    plan_data = {
                        "plan_number": plan_idx + 1,
                        "plan_name": plan_name.strip() if plan_name else f"Plan {plan_idx + 1}",
                        "premium": premium,
                        "network": network,
                        "tpa": tpa,
                        "copay": copay,
                        "coverage_details": coverage_details
                    }
                    
                    raw_plans.append(plan_data)
                    
                except Exception as e:
                    self.logger.warning(f"  Warning: Could not build plan {plan_idx + 1}: {e}")
                    continue
            
            self.logger.info(f"✅ Successfully extracted {len(raw_plans)} raw plan(s)")
            
            # Step 6: Parse raw plans to StandardPlan format
            self.logger.info("🔄 Parsing plans to StandardPlan format...")
            for raw_plan in raw_plans:
                try:
                    structured_plan = self.parser.parse_plan(raw_plan, self.form_data)
                    structured_plans.append(structured_plan)
                except Exception as e:
                    self.logger.error(f"Failed to parse plan {raw_plan.get('plan_name')}: {e}")
            
            self.logger.info(f"✅ Successfully parsed {len(structured_plans)} plans to StandardPlan format")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to extract plans: {e}", exc_info=True)
        
        return structured_plans







