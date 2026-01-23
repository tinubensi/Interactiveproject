"""
GIG Gulf Plan Scraper Module
Handles extraction of insurance plan details from GIG Gulf portal
"""
import asyncio
import os
import re
import json
from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from vendors.base.utils import setup_logging
from vendors.gig_gulf.parser import GigGulfParser


class GigGulfScraper:
    """
    Scraper class for extracting GIG Gulf insurance plan details
    Extracts plans from the plans page after form submission
    """
    
    def __init__(self, page: Page, config: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None):
        self.page = page
        self.config = config or {}
        self.form_data = form_data
        self.logger = setup_logging(self.config.get('log_level', 'INFO'))
        self.parser = GigGulfParser()
    
    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        """
        Extract all insurance plans from the current page
        
        Returns:
            List of parsed plans in StandardPlan format
        """
        self.logger.info("🚀 Starting GIG Gulf plan extraction...")
        await self.page.wait_for_load_state("networkidle")
        await asyncio.sleep(2)
        
        structured_plans = []
        
        try:
            # Scroll to load all plans
            self.logger.info("Scrolling to load all plan sections...")
            await self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(2)
            await self.page.wait_for_load_state("networkidle")
            self.logger.info("✓ Page scrolled to bottom")
            
            # Take a screenshot to see the plans page structure
            if self.config.get('enable_screenshots'):
                from vendors.base.utils import save_screenshot
                await save_screenshot(self.page, "giggulf_plans_page_full")
            
            # Try to find plan cards/containers
            # Common selectors for insurance plan displays
            plan_selectors = [
                ".plan-card",
                ".insurance-plan",
                ".product-card",
                "[class*='plan']",
                ".card",
                "[data-plan]",
                ".plan-item"
            ]
            
            plan_elements = None
            selected_selector = None
            
            # Try each selector to find plan elements
            for selector in plan_selectors:
                count = await self.page.locator(selector).count()
                if count > 0:
                    plan_elements = await self.page.locator(selector).all()
                    selected_selector = selector
                    self.logger.info(f"Found {count} plan elements using selector: {selector}")
                    break
            
            if not plan_elements or len(plan_elements) == 0:
                # Fallback: Try to extract from page content
                self.logger.warning("No plan elements found with standard selectors, trying content extraction...")
                page_content = await self.page.content()
                
                # Save the HTML for debugging
                html_path = "/tmp/giggulf_plans_page.html"
                with open(html_path, "w", encoding="utf-8") as f:
                    f.write(page_content)
                self.logger.info(f"Saved page HTML to: {html_path}")
                
                # Try to extract plan data from JavaScript/JSON embedded in page
                json_data = await self._extract_json_from_page()
                if json_data:
                    self.logger.info("Found JSON data in page, parsing...")
                    structured_plans = self.parser.parse_plans_from_json(json_data, self.form_data)
                    return structured_plans
                
                # If still no data, extract from HTML tables
                structured_plans = await self._extract_from_tables()
                if structured_plans:
                    return structured_plans
                
                self.logger.error("❌ NO PLANS FOUND!")
                return []
            
            # Process each plan element
            num_plans = len(plan_elements)
            self.logger.info(f"Processing {num_plans} plans...")
            
            for index, plan_element in enumerate(plan_elements):
                self.logger.info(f"\nProcessing plan {index + 1}/{num_plans}...")
                
                try:
                    # Extract plan data from the element
                    plan_data = await self._extract_plan_from_element(plan_element, index)
                    
                    if plan_data:
                        # Parse the plan data
                        parsed_plan = self.parser.parse_plan_data(plan_data, self.form_data)
                        structured_plans.append(parsed_plan)
                        self.logger.info(f"  ✓ Plan extracted: {parsed_plan.get('planName', 'Unknown')}")
                    else:
                        self.logger.warning(f"  ⚠️ No data extracted for plan {index + 1}")
                
                except Exception as e:
                    self.logger.error(f"Error processing plan {index + 1}: {e}")
                    continue
            
            self.logger.info(f"\n✅ Successfully extracted {len(structured_plans)} plans")
            return structured_plans
        
        except Exception as e:
            self.logger.error(f"Error extracting plans: {e}")
            import traceback
            self.logger.error(traceback.format_exc())
            return []
    
    async def _extract_plan_from_element(self, element, index: int) -> Optional[Dict[str, Any]]:
        """
        Extract plan details from a single plan element
        
        Returns:
            Dictionary with raw plan data
        """
        try:
            # Get text content
            text_content = await element.inner_text()
            
            # Try to extract structured data
            plan_data = {
                'index': index,
                'raw_text': text_content
            }
            
            # Try to find plan name
            plan_name_elem = element.locator("h1, h2, h3, h4, .plan-name, [class*='title']").first
            if await plan_name_elem.count() > 0:
                plan_data['plan_name'] = await plan_name_elem.inner_text()
            
            # Try to find premium/price
            price_elem = element.locator("[class*='price'], [class*='premium'], [class*='amount']").first
            if await price_elem.count() > 0:
                price_text = await price_elem.inner_text()
                # Extract numeric value
                price_match = re.search(r'([\d,]+\.?\d*)', price_text.replace(",", ""))
                if price_match:
                    plan_data['premium'] = float(price_match.group(1))
            
            # Try to find coverage limit
            limit_elem = element.locator("[class*='limit'], [class*='coverage']").first
            if await limit_elem.count() > 0:
                limit_text = await limit_elem.inner_text()
                # Extract numeric value
                limit_match = re.search(r'([\d,]+)', limit_text.replace(",", ""))
                if limit_match:
                    plan_data['coverage_limit'] = float(limit_match.group(1))
            
            # Extract all list items (benefits)
            benefits = []
            benefit_elems = await element.locator("li, [class*='benefit']").all()
            for benefit_elem in benefit_elems:
                benefit_text = await benefit_elem.inner_text()
                if benefit_text and len(benefit_text.strip()) > 0:
                    benefits.append(benefit_text.strip())
            
            if benefits:
                plan_data['benefits'] = benefits
            
            # Try to get data attributes
            try:
                data_attrs = await element.evaluate("""
                    (el) => {
                        const attrs = {};
                        for (let attr of el.attributes) {
                            if (attr.name.startsWith('data-')) {
                                attrs[attr.name] = attr.value;
                            }
                        }
                        return attrs;
                    }
                """)
                if data_attrs:
                    plan_data['data_attributes'] = data_attrs
            except:
                pass
            
            return plan_data
        
        except Exception as e:
            self.logger.error(f"Error extracting plan from element: {e}")
            return None
    
    async def _extract_json_from_page(self) -> Optional[Any]:
        """
        Try to extract JSON data embedded in the page
        """
        try:
            # Try to find script tags with JSON data
            json_data = await self.page.evaluate("""
                () => {
                    // Look for common patterns where plan data might be stored
                    const scripts = document.querySelectorAll('script');
                    for (let script of scripts) {
                        const content = script.textContent;
                        // Look for variable assignments with plan data
                        const patterns = [
                            /plans\s*=\s*(\[.*?\]);/s,
                            /planData\s*=\s*(\[.*?\]);/s,
                            /products\s*=\s*(\[.*?\]);/s,
                            /var\s+\w+\s*=\s*(\[.*?\]);/s
                        ];
                        for (let pattern of patterns) {
                            const match = content.match(pattern);
                            if (match) {
                                try {
                                    return JSON.parse(match[1]);
                                } catch (e) {}
                            }
                        }
                    }
                    return null;
                }
            """)
            
            if json_data:
                self.logger.info(f"Found JSON data: {len(json_data) if isinstance(json_data, list) else 'object'}")
                return json_data
        
        except Exception as e:
            self.logger.debug(f"Could not extract JSON from page: {e}")
        
        return None
    
    async def _extract_from_tables(self) -> List[Dict[str, Any]]:
        """
        Extract plan data from HTML tables
        """
        plans = []
        
        try:
            # Find all tables
            tables = await self.page.locator("table").all()
            
            if not tables:
                return []
            
            self.logger.info(f"Found {len(tables)} tables, extracting data...")
            
            for table_index, table in enumerate(tables):
                # Extract table data
                rows = await table.locator("tr").all()
                
                if len(rows) < 2:
                    continue
                
                # Try to extract headers
                headers = []
                header_row = rows[0]
                header_cells = await header_row.locator("th, td").all()
                for cell in header_cells:
                    header_text = await cell.inner_text()
                    headers.append(header_text.strip())
                
                # Extract data rows
                for row_index, row in enumerate(rows[1:], start=1):
                    cells = await row.locator("td").all()
                    if len(cells) == 0:
                        continue
                    
                    row_data = {}
                    for i, cell in enumerate(cells):
                        cell_text = await cell.inner_text()
                        header = headers[i] if i < len(headers) else f"column_{i}"
                        row_data[header] = cell_text.strip()
                    
                    if row_data:
                        # Parse the row data as a plan
                        plan = self.parser.parse_plan_data(row_data, self.form_data)
                        plans.append(plan)
                        self.logger.info(f"  ✓ Extracted plan from table {table_index + 1}, row {row_index}")
            
            return plans
        
        except Exception as e:
            self.logger.error(f"Error extracting from tables: {e}")
            return []
