"""
Watania Plan Scraper Module
Handles extraction of insurance plan details from Watania portal including popup windows and PDFs
"""

from typing import List, Dict, Any, Optional
from playwright.async_api import Page
from vendors.base.utils import clean_text, setup_logging
from vendors.watania.parser import WataniaDataParser
import asyncio
import PyPDF2
import pdfplumber
from io import BytesIO
import re
import uuid


class WataniaScraper:
    """
    Scraper class for extracting Watania insurance plan details
    Handles main plan cards, sub-plans, and popup window content
    """
    
    def __init__(self, page: Page, config: Optional[Dict[str, Any]] = None, form_data: Optional[Dict[str, Any]] = None):
        """
        Initialize the Watania Scraper
        
        Args:
            page: Playwright page object
            config: Optional configuration dictionary
            form_data: Optional form data for context
        """
        self.page = page
        self.config = config or {}
        self.form_data = form_data
        self.logger = setup_logging(self.config.get('log_level', 'INFO'))
        self.parser = WataniaDataParser()
    
    async def extract_all_plans(self, bot) -> List[Dict[str, Any]]:
        """
        Extract all insurance plans with COMPREHENSIVE data for comparison
        
        Args:
            bot: WataniaBot instance for navigation and popup handling
        
        Returns:
            List of structured plan dictionaries with complete comparison data
        """
        self.logger.info("🚀 Starting COMPREHENSIVE Watania plan extraction...")
        
        structured_plans = []
        
        try:
            # Get number of plans
            plan_count = await bot.get_plan_count()
            
            if plan_count == 0:
                self.logger.warning("No plans found on the page")
                return []
            
            # Iterate through each main plan
            for plan_index in range(plan_count):
                self.logger.info(f"📊 Processing plan {plan_index + 1}/{plan_count} with FULL extraction")
                
                # STEP 1: Extract pricing from plan card (before clicking)
                plan_pricing = await self._extract_comprehensive_pricing(bot, plan_index)
                self.logger.info(f"💰 Pricing: {plan_pricing.get('displayedPrice', 'N/A')}")
                
                # STEP 2: Click Choose to expand details
                await bot.click_choose_button(plan_index)
                await asyncio.sleep(2)  # Give time for content to load
                
                # STEP 3: Extract comprehensive data from visible page
                comprehensive_data = await self._extract_comprehensive_page_data(bot, plan_index)
                self.logger.info(f"📋 Extracted coverage limits, benefits, and restrictions")
                
                # STEP 4: Extract sub-plans with all data
                sub_plans = await self._extract_sub_plans_comprehensive(bot, plan_index, plan_pricing, comprehensive_data)
                
                # STEP 5: Convert to structured format with ALL data
                for sub_plan in sub_plans:
                    structured_plan = self.parser.parse_plan_comprehensive(sub_plan, self.form_data)
                    structured_plans.append(structured_plan)
                
                # Navigate back to plans list for next iteration
                if plan_index < plan_count - 1:
                    await bot.go_back_to_plans_list()
            
            self.logger.info(f"✅ Successfully extracted {len(structured_plans)} plans with COMPLETE data")
            return structured_plans
        
        except Exception as e:
            self.logger.error(f"❌ Failed to extract plans: {e}", exc_info=True)
            return structured_plans
    
    async def _extract_sub_plans(self, bot, plan_index: int) -> List[Dict[str, Any]]:
        """
        Extract all sub-plans after clicking Choose button
        
        Args:
            bot: WataniaBot instance
            plan_index: Index of the main plan
        
        Returns:
            List of sub-plan dictionaries
        """
        sub_plans = []
        
        try:
            # Wait for sub-plans to render
            await asyncio.sleep(1)
            
            # Look for sub-plan containers
            # Based on recording: divs with text like "Class A NE1 (0-45) V4"
            sub_plan_divs = await self.page.locator('div').filter(has_text='Class').all()
            
            self.logger.debug(f"Found {len(sub_plan_divs)} potential sub-plan elements")
            
            # Try to find info icons - these open the popups
            info_icons = await self.page.locator('div i').all()
            
            self.logger.info(f"Found {len(info_icons)} info icons for sub-plans")
            
            # Iterate through info icons and extract popup content
            for idx, icon in enumerate(info_icons):
                try:
                    self.logger.debug(f"Processing sub-plan {idx + 1}")
                    
                    # Get the parent div to extract sub-plan name
                    try:
                        parent = icon.locator('..').locator('..')
                        sub_plan_name = await parent.inner_text()
                        sub_plan_name = clean_text(sub_plan_name.split('\n')[0]) if sub_plan_name else f"Sub-Plan {idx + 1}"
                    except:
                        sub_plan_name = f"Sub-Plan {idx + 1}"
                    
                    # Click info icon and get popup
                    popup = await bot.click_info_icon_and_get_popup(icon)
                    
                    if popup:
                        # Extract details from popup
                        details = await self._extract_popup_details(popup)
                        
                        sub_plan_data = {
                            'sub_plan_number': idx + 1,
                            'sub_plan_name': sub_plan_name,
                            'benefits': details.get('benefits', []),
                            'coverage': details.get('coverage', []),
                            'pricing': details.get('pricing', 'Not specified'),
                            'terms': details.get('terms', 'Not specified')
                        }
                        
                        # Close popup
                        await bot.close_popup(popup)
                    else:
                        # 🆕 POPUP FAILED - Create sub-plan with available data
                        self.logger.warning(f"⚠️ Popup failed for {sub_plan_name}, using default data")
                        sub_plan_data = {
                            'sub_plan_number': idx + 1,
                            'sub_plan_name': sub_plan_name,
                            'benefits': [],
                            'coverage': [],
                            'pricing': 'Not specified',  # Will be filled from main plan
                            'terms': 'Subject to policy terms and conditions'
                        }
                    
                    sub_plans.append(sub_plan_data)
                    
                    # Brief delay between popups
                    await asyncio.sleep(0.5)
                
                except Exception as e:
                    self.logger.warning(f"Failed to extract sub-plan {idx + 1}: {e}")
                    continue
            
            return sub_plans
        
        except Exception as e:
            self.logger.error(f"Failed to extract sub-plans: {e}")
            return sub_plans
    
    async def _extract_comprehensive_pricing(self, bot, plan_index: int) -> Dict[str, Any]:
        """
        Extract COMPLETE pricing information from plan card
        Returns dictionary with annual, monthly, and display price
        """
        pricing = {
            "annualPremium": 0,
            "monthlyPremium": 0,
            "displayedPrice": "Not specified",
            "currency": "AED",
            "isPromo": False
        }
        
        try:
            await asyncio.sleep(0.5)
            plan_cards = await self.page.locator('div:has(button:has-text("Choose"))').all()
            
            if plan_index < len(plan_cards):
                card = plan_cards[plan_index]
                card_text = await card.inner_text()
                
                # Pattern 1: Annual Premium
                annual_patterns = [
                    r'(?:Annual|Yearly)\s*Premium[:\s]*AED\s*([\d,]+)',
                    r'AED\s*([\d,]+)\s*(?:per\s+year|annually|/year)',
                    r'(?:Total|Price)[:\s]*AED\s*([\d,]+)\s*(?:per\s+year|annually)'
                ]
                
                for pattern in annual_patterns:
                    match = re.search(pattern, card_text, re.IGNORECASE)
                    if match:
                        amount = int(match.group(1).replace(',', ''))
                        pricing["annualPremium"] = amount
                        pricing["monthlyPremium"] = round(amount / 12)
                        pricing["displayedPrice"] = f"AED {match.group(1)}"
                        self.logger.info(f"💰 Found annual premium: AED {amount:,}")
                        return pricing
                
                # Pattern 2: Monthly Premium
                monthly_patterns = [
                    r'(?:Monthly|Per\s+Month)[:\s]*AED\s*([\d,]+)',
                    r'AED\s*([\d,]+)\s*(?:/month|per\s+month|monthly)'
                ]
                
                for pattern in monthly_patterns:
                    match = re.search(pattern, card_text, re.IGNORECASE)
                    if match:
                        amount = int(match.group(1).replace(',', ''))
                        pricing["monthlyPremium"] = amount
                        pricing["annualPremium"] = amount * 12
                        pricing["displayedPrice"] = f"AED {match.group(1)}/month"
                        self.logger.info(f"💰 Found monthly premium: AED {amount:,} (Annual: AED {amount * 12:,})")
                        return pricing
                
                # Pattern 3: Generic price (guess based on amount)
                generic_match = re.search(r'AED\s*([\d,]+)', card_text, re.IGNORECASE)
                if generic_match:
                    amount = int(generic_match.group(1).replace(',', ''))
                    
                    if amount < 2000:  # Likely monthly (< AED 2,000)
                        pricing["monthlyPremium"] = amount
                        pricing["annualPremium"] = amount * 12
                        pricing["displayedPrice"] = f"AED {generic_match.group(1)}"
                        self.logger.info(f"💰 Detected monthly price: AED {amount:,} → Annual: AED {amount * 12:,}")
                    else:  # Likely annual (>= AED 2,000)
                        pricing["annualPremium"] = amount
                        pricing["monthlyPremium"] = round(amount / 12)
                        pricing["displayedPrice"] = f"AED {generic_match.group(1)}"
                        self.logger.info(f"💰 Detected annual price: AED {amount:,}")
                    
                    return pricing
            
            self.logger.warning("⚠️ Could not extract pricing from plan card")
            
        except Exception as e:
            self.logger.error(f"Failed to extract comprehensive pricing: {e}")
        
        return pricing
    
    async def _extract_comprehensive_page_data(self, bot, plan_index: int) -> Dict[str, Any]:
        """
        Extract ALL data from the visible expanded plan page
        Includes: coverage limits, benefits, cost sharing, restrictions
        """
        self.logger.info("📄 Extracting comprehensive data from visible page...")
        
        comprehensive_data = {
            "coverageLimits": await self._extract_coverage_limits(),
            "benefits": await self._extract_detailed_benefits(),
            "costSharing": await self._extract_cost_sharing(),
            "restrictions": await self._extract_restrictions()
        }
        
        return comprehensive_data
    
    async def _extract_coverage_limits(self) -> Dict[str, int]:
        """
        Extract all coverage limits (annual limit, inpatient, outpatient, etc.)
        """
        coverage = {
            "annualLimit": 0,
            "inpatientLimit": 0,
            "outpatientLimit": 0,
            "maternityLimit": 0,
            "emergencyLimit": 0,
            "pharmacyLimit": 0,
            "dentalLimit": 0,
            "opticalLimit": 0
        }
        
        try:
            page_text = await self.page.inner_text('body')
            
            # Extract each limit with multiple pattern variations
            limit_patterns = {
                "annualLimit": [
                    r'Annual\s+(?:Coverage\s+)?Limit[:\s]*AED\s*([\d,]+)',
                    r'Total\s+Coverage[:\s]*AED\s*([\d,]+)',
                    r'Maximum\s+Annual\s+Benefit[:\s]*AED\s*([\d,]+)'
                ],
                "inpatientLimit": [
                    r'Inpatient[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'In-?patient\s+Coverage[:\s]*AED\s*([\d,]+)'
                ],
                "outpatientLimit": [
                    r'Outpatient[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'Out-?patient\s+Coverage[:\s]*AED\s*([\d,]+)'
                ],
                "maternityLimit": [
                    r'Maternity[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'Maternity\s+Coverage[:\s]*AED\s*([\d,]+)'
                ],
                "emergencyLimit": [
                    r'Emergency[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'Emergency\s+Coverage[:\s]*AED\s*([\d,]+)'
                ],
                "pharmacyLimit": [
                    r'Pharmacy[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'Medication[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)'
                ],
                "dentalLimit": [
                    r'Dental[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'Dental\s+Coverage[:\s]*AED\s*([\d,]+)'
                ],
                "opticalLimit": [
                    r'Optical[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)',
                    r'Vision[:\s]*(?:up\s+to\s+)?AED\s*([\d,]+)'
                ]
            }
            
            for limit_key, patterns in limit_patterns.items():
                for pattern in patterns:
                    match = re.search(pattern, page_text, re.IGNORECASE)
                    if match:
                        coverage[limit_key] = int(match.group(1).replace(',', ''))
                        self.logger.debug(f"  ✅ {limit_key}: AED {coverage[limit_key]:,}")
                        break
            
            self.logger.info(f"📊 Coverage Limits: Annual={coverage['annualLimit']:,}, Inpatient={coverage['inpatientLimit']:,}")
            
        except Exception as e:
            self.logger.error(f"Failed to extract coverage limits: {e}")
        
        return coverage
    
    async def _extract_detailed_benefits(self) -> List[Dict[str, Any]]:
        """
        Extract benefits organized by category with specific items
        """
        benefits = []
        
        try:
            # Strategy 1: Try to find structured benefit sections
            page_text = await self.page.inner_text('body')
            lines = [line.strip() for line in page_text.split('\n') if line.strip()]
            
            # Define benefit categories and their keywords
            categories = {
                "Inpatient Care": ["inpatient", "hospital", "icu", "surgery", "admission", "room"],
                "Outpatient Care": ["outpatient", "clinic", "consultation", "gp", "specialist"],
                "Maternity": ["maternity", "pregnancy", "delivery", "prenatal", "postnatal"],
                "Emergency": ["emergency", "accident", "ambulance"],
                "Pharmacy": ["pharmacy", "medication", "prescription", "drug"],
                "Dental": ["dental", "teeth", "orthodontic"],
                "Optical": ["optical", "vision", "eye", "glasses", "lenses"]
            }
            
            # Extract benefits for each category
            for category, keywords in categories.items():
                category_benefits = []
                
                for line in lines:
                    line_lower = line.lower()
                    
                    # Check if line contains category keywords
                    if any(kw in line_lower for kw in keywords):
                        # Must be substantial and look like a benefit description
                        if len(line) > 15 and not line.isupper():
                            # Check for common benefit patterns
                            if any(indicator in line_lower for indicator in [
                                'cover', 'include', 'benefit', 'up to', 'aed', '%', 
                                'per', 'day', 'visit', 'treatment', 'care'
                            ]):
                                cleaned = clean_text(line)
                                if cleaned not in category_benefits:
                                    category_benefits.append(cleaned)
                
                if category_benefits:
                    benefits.append({
                        "category": category,
                        "items": category_benefits[:10]  # Limit to 10 items per category
                    })
                    self.logger.debug(f"  ✅ {category}: {len(category_benefits)} benefits")
            
            # If no structured benefits found, add default
            if not benefits:
                self.logger.warning("⚠️ No detailed benefits found, using defaults")
                benefits = [{
                    "category": "Standard Benefits",
                    "items": ["Basic health coverage as per policy terms"]
                }]
            else:
                self.logger.info(f"📋 Extracted {len(benefits)} benefit categories with detailed items")
            
        except Exception as e:
            self.logger.error(f"Failed to extract detailed benefits: {e}")
            benefits = [{
                "category": "Standard Benefits",
                "items": ["Basic health coverage as per policy terms"]
            }]
        
        return benefits
    
    async def _extract_cost_sharing(self) -> Dict[str, Any]:
        """
        Extract cost-sharing details: deductible, coinsurance, copays
        """
        cost_sharing = {
            "deductible": 0,
            "coInsurance": 0,
            "copays": {}
        }
        
        try:
            page_text = await self.page.inner_text('body')
            
            # Deductible
            ded_patterns = [
                r'Deductible[:\s]*AED\s*([\d,]+)',
                r'Excess[:\s]*AED\s*([\d,]+)'
            ]
            for pattern in ded_patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    cost_sharing["deductible"] = int(match.group(1).replace(',', ''))
                    self.logger.debug(f"  ✅ Deductible: AED {cost_sharing['deductible']:,}")
                    break
            
            # Co-insurance (percentage patient pays)
            coins_patterns = [
                r'Co-?insurance[:\s]*([\d]+)%',
                r'Co-?payment[:\s]*([\d]+)%',
                r'Patient\s+pays[:\s]*([\d]+)%'
            ]
            for pattern in coins_patterns:
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    cost_sharing["coInsurance"] = int(match.group(1))
                    self.logger.debug(f"  ✅ Co-insurance: {cost_sharing['coInsurance']}%")
                    break
            
            # Copays for specific services
            copay_patterns = {
                "gpVisit": r'GP\s+(?:visit|consultation)[:\s]*AED\s*([\d,]+)',
                "specialistVisit": r'Specialist[:\s]*AED\s*([\d,]+)',
                "emergency": r'Emergency\s+(?:visit|copay)[:\s]*AED\s*([\d,]+)'
            }
            
            for service, pattern in copay_patterns.items():
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    cost_sharing["copays"][service] = int(match.group(1).replace(',', ''))
                    self.logger.debug(f"  ✅ {service} copay: AED {cost_sharing['copays'][service]:,}")
            
            self.logger.info(f"💳 Cost Sharing: Deductible={cost_sharing['deductible']}, CoInsurance={cost_sharing['coInsurance']}%")
            
        except Exception as e:
            self.logger.error(f"Failed to extract cost sharing: {e}")
        
        return cost_sharing
    
    async def _extract_restrictions(self) -> Dict[str, Any]:
        """
        Extract exclusions, waiting periods, and other restrictions
        """
        restrictions = {
            "exclusions": [],
            "waitingPeriods": {},
            "ageRestrictions": {},
            "territorialLimits": []
        }
        
        try:
            page_text = await self.page.inner_text('body')
            lines = [line.strip() for line in page_text.split('\n') if line.strip()]
            
            # Extract exclusions
            exclusion_keywords = ['not covered', 'excluded', 'exclusion', 'not include', 'except']
            for line in lines:
                if any(kw in line.lower() for kw in exclusion_keywords):
                    cleaned = clean_text(line)
                    if len(cleaned) > 15 and cleaned not in restrictions["exclusions"]:
                        restrictions["exclusions"].append(cleaned)
            
            # Limit exclusions
            restrictions["exclusions"] = restrictions["exclusions"][:5]
            
            # If no exclusions found, add defaults
            if not restrictions["exclusions"]:
                restrictions["exclusions"] = [
                    "Pre-existing conditions may be excluded",
                    "Subject to policy terms and conditions"
                ]
            
            # Extract waiting periods
            wait_patterns = {
                "general": r'waiting period[:\s]*([\d]+)\s*days',
                "maternity": r'maternity.*?waiting[:\s]*([\d]+)\s*days',
                "preexisting": r'pre-?existing.*?([\d]+)\s*(?:days|months)'
            }
            
            for key, pattern in wait_patterns.items():
                match = re.search(pattern, page_text, re.IGNORECASE)
                if match:
                    days = int(match.group(1))
                    # Convert months to days if needed
                    if 'month' in match.group(0).lower():
                        days = days * 30
                    restrictions["waitingPeriods"][key] = days
            
            # Default waiting periods if not found
            if not restrictions["waitingPeriods"]:
                restrictions["waitingPeriods"] = {"general": 30}
            
            # Extract age restrictions
            age_match = re.search(r'(\d+)-(\d+)\s*years?', page_text)
            if age_match:
                restrictions["ageRestrictions"] = {
                    "min": int(age_match.group(1)),
                    "max": int(age_match.group(2))
                }
            
            self.logger.info(f"⚠️ Restrictions: {len(restrictions['exclusions'])} exclusions, waiting periods: {restrictions['waitingPeriods']}")
            
        except Exception as e:
            self.logger.error(f"Failed to extract restrictions: {e}")
        
        return restrictions
    
    async def _extract_sub_plans_comprehensive(self, bot, plan_index: int, plan_pricing: Dict, comprehensive_data: Dict) -> List[Dict[str, Any]]:
        """
        Extract sub-plans with ALL comprehensive data
        """
        sub_plans = []
        
        try:
            await asyncio.sleep(1)
            
            # Look for sub-plan divs
            sub_plan_divs = await self.page.locator('div').filter(has_text='Class').all()
            self.logger.debug(f"Found {len(sub_plan_divs)} potential sub-plan elements")
            
            # Try to find info icons
            info_icons = await self.page.locator('div i').all()
            self.logger.info(f"Found {len(info_icons)} info icons for sub-plans")
            
            # Iterate through info icons
            for idx, icon in enumerate(info_icons):
                try:
                    self.logger.debug(f"Processing sub-plan {idx + 1}")
                    
                    # Get sub-plan name
                    try:
                        parent = icon.locator('..').locator('..')
                        sub_plan_name = await parent.inner_text()
                        sub_plan_name = clean_text(sub_plan_name.split('\n')[0]) if sub_plan_name else f"Sub-Plan {idx + 1}"
                    except:
                        sub_plan_name = f"Sub-Plan {idx + 1}"
                    
                    # Try to get popup details (with reduced timeout)
                    popup = await bot.click_info_icon_and_get_popup(icon)
                    
                    popup_details = {}
                    if popup:
                        popup_details = await self._extract_popup_details(popup)
                        await bot.close_popup(popup)
                    
                    # Build comprehensive sub-plan data
                    sub_plan_data = {
                        'sub_plan_number': idx + 1,
                        'sub_plan_name': sub_plan_name,
                        
                        # Pricing from main plan
                        'pricing': plan_pricing.get('displayedPrice', 'Not specified'),
                        'annualPremium': plan_pricing.get('annualPremium', 0),
                        'monthlyPremium': plan_pricing.get('monthlyPremium', 0),
                        
                        # Coverage limits
                        'coverageLimits': comprehensive_data.get('coverageLimits', {}),
                        
                        # Benefits (merge popup + page data)
                        'benefits': popup_details.get('benefits', []) or [item for cat in comprehensive_data.get('benefits', []) for item in cat.get('items', [])],
                        'benefitsCategories': comprehensive_data.get('benefits', []),
                        
                        # Coverage details
                        'coverage': popup_details.get('coverage', []),
                        
                        # Cost sharing (include from PDF if available)
                        'costSharing': comprehensive_data.get('costSharing', {}),
                        'deductible': popup_details.get('deductible', 0) or comprehensive_data.get('costSharing', {}).get('deductible', 0),
                        'coInsurance': popup_details.get('coInsurance', 0) or comprehensive_data.get('costSharing', {}).get('coInsurance', 0),
                        
                        # Restrictions
                        'exclusions': comprehensive_data.get('restrictions', {}).get('exclusions', []),
                        'waitingPeriods': comprehensive_data.get('restrictions', {}).get('waitingPeriods', {}),
                        
                        # Terms
                        'terms': popup_details.get('terms', 'Subject to policy terms and conditions')
                    }
                    
                    sub_plans.append(sub_plan_data)
                    self.logger.info(f"✅ Comprehensive data for: {sub_plan_name}")
                    
                    await asyncio.sleep(0.5)
                
                except Exception as e:
                    self.logger.warning(f"Failed to extract sub-plan {idx + 1}: {e}")
                    continue
            
            return sub_plans
        
        except Exception as e:
            self.logger.error(f"Failed to extract sub-plans comprehensively: {e}")
            return sub_plans
    
    async def _extract_pricing_from_plan_card(self, bot, plan_index: int) -> str:
        """
        Extract pricing information from the main plan card BEFORE opening sub-plans.
        This is the primary source of pricing as popups may fail.
        
        Args:
            bot: WataniaBot instance
            plan_index: Index of the main plan
        
        Returns:
            Pricing string (e.g., "AED 75,000")
        """
        try:
            # Wait a moment for plan cards to be visible
            await asyncio.sleep(0.5)
            
            # Look for pricing text near the Choose button
            # Common patterns: "AED 75,000", "75,000 AED", "Annual Premium: AED 75,000"
            
            # Strategy 1: Find the plan card container
            plan_cards = await self.page.locator('div:has(button:has-text("Choose"))').all()
            
            if plan_index < len(plan_cards):
                card = plan_cards[plan_index]
                card_text = await card.inner_text()
                
                # Look for AED amounts in the card
                price_matches = re.findall(r'AED\s*[\d,]+', card_text, re.IGNORECASE)
                
                if price_matches:
                    # Return the largest amount (usually the annual premium)
                    prices = []
                    for match in price_matches:
                        num_str = re.sub(r'[^\d]', '', match)
                        if num_str:
                            prices.append((int(num_str), match))
                    
                    if prices:
                        prices.sort(reverse=True)
                        self.logger.info(f"💰 Found pricing from plan card: {prices[0][1]}")
                        return prices[0][1]
            
            # Strategy 2: Look for any text with AED near the plan
            all_text = await self.page.inner_text('body')
            lines = all_text.split('\n')
            
            for line in lines:
                if 'AED' in line and any(char.isdigit() for char in line):
                    price_match = re.search(r'AED\s*[\d,]+', line, re.IGNORECASE)
                    if price_match:
                        self.logger.info(f"💰 Found pricing from page text: {price_match.group()}")
                        return price_match.group()
            
            self.logger.warning("⚠️ Could not extract pricing from plan card")
            return "Not specified"
        
        except Exception as e:
            self.logger.error(f"Failed to extract pricing from plan card: {e}")
            return "Not specified"
    
    async def _extract_popup_details(self, popup: Page) -> Dict[str, Any]:
        """
        Extract details from a popup window (handles both HTML and PDF content)
        
        Args:
            popup: The popup page object
        
        Returns:
            Dictionary containing benefits, coverage, pricing, and terms
        """
        details = {
            'benefits': [],
            'coverage': [],
            'pricing': 'Not specified',
            'terms': 'Not specified'
        }
        
        try:
            # Wait for content to load
            await popup.wait_for_load_state('networkidle', timeout=5000)
            await asyncio.sleep(1)
            
            # Check if popup is displaying a PDF
            popup_url = popup.url
            self.logger.debug(f"Popup URL: {popup_url}")
            
            # If it's a PDF URL, extract from PDF
            if popup_url.endswith('.pdf') or 'pdf' in popup_url.lower() or 'application/pdf' in await self._get_content_type(popup):
                self.logger.info("Detected PDF content in popup, extracting...")
                details = await self._extract_from_pdf_popup(popup)
            else:
                # Try HTML extraction
                try:
                    body_text = await popup.locator('body').inner_text()
                    
                    # Extract benefits (look for list items, bullet points, etc.)
                    benefits = await self._extract_benefits_from_popup(popup)
                    if benefits:
                        details['benefits'] = benefits
                    
                    # Extract coverage information
                    coverage = await self._extract_coverage_from_popup(popup)
                    if coverage:
                        details['coverage'] = coverage
                    
                    # Extract pricing information
                    pricing = await self._extract_pricing_from_popup(popup)
                    if pricing:
                        details['pricing'] = pricing
                    
                    # Extract terms
                    terms = await self._extract_terms_from_popup(popup)
                    if terms:
                        details['terms'] = terms
                    
                    # If specific extraction failed, parse general content
                    if not details['benefits'] and not details['coverage']:
                        details['raw_content'] = clean_text(body_text)
                except:
                    pass
            
            self.logger.debug("Successfully extracted popup details")
            
        except Exception as e:
            self.logger.warning(f"Failed to extract popup details: {e}")
        
        return details
    
    async def _get_content_type(self, popup: Page) -> str:
        """Get the content type of the popup page"""
        try:
            content_type = await popup.evaluate("() => document.contentType")
            return content_type
        except:
            return ""
    
    async def _extract_from_pdf_popup(self, popup: Page) -> Dict[str, Any]:
        """
        Extract content from a PDF displayed in popup
        
        Args:
            popup: Popup page containing PDF
        
        Returns:
            Dictionary with extracted details
        """
        details = {
            'benefits': [],
            'coverage': [],
            'pricing': 'Not specified',
            'terms': 'Not specified'
        }
        
        try:
            # Get PDF URL
            pdf_url = popup.url
            self.logger.info(f"📄 Downloading PDF from: {pdf_url}")
            
            # Download PDF content using Playwright's request context
            response = await popup.context.request.get(pdf_url)
            pdf_bytes = await response.body()
            
            self.logger.info(f"✅ PDF downloaded, size: {len(pdf_bytes)} bytes")
            
            if len(pdf_bytes) < 100:
                self.logger.warning(f"⚠️ PDF file is suspiciously small ({len(pdf_bytes)} bytes), might be empty")
                return details
            
            # Extract text from PDF
            pdf_text = self._extract_text_from_pdf(pdf_bytes)
            
            if pdf_text:
                self.logger.info(f"✅ Extracted {len(pdf_text)} characters from PDF")
                
                # Log first 500 chars for debugging
                self.logger.debug(f"PDF preview: {pdf_text[:500]}")
                
                # Parse the text for structured data
                details = self._parse_pdf_text(pdf_text)
                
                self.logger.info(f"📊 Parsed from PDF: {len(details['benefits'])} benefits, "
                               f"{len(details['coverage'])} coverage items, pricing: {details['pricing']}")
            else:
                self.logger.warning("⚠️ No text extracted from PDF (might be image-based or encrypted)")
            
        except Exception as e:
            self.logger.error(f"❌ Failed to extract from PDF: {e}", exc_info=True)
        
        return details
    
    def _extract_text_from_pdf(self, pdf_bytes: bytes) -> str:
        """
        Extract text from PDF bytes using multiple methods
        
        Args:
            pdf_bytes: PDF file content as bytes
        
        Returns:
            Extracted text
        """
        text = ""
        
        # Method 1: Try pdfplumber (better for tables and formatted text)
        try:
            with pdfplumber.open(BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                
                if text:
                    self.logger.debug("Text extracted using pdfplumber")
                    return text
        except Exception as e:
            self.logger.debug(f"pdfplumber extraction failed: {e}")
        
        # Method 2: Try PyPDF2 (fallback)
        try:
            pdf_file = BytesIO(pdf_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            if text:
                self.logger.debug("Text extracted using PyPDF2")
                return text
        except Exception as e:
            self.logger.debug(f"PyPDF2 extraction failed: {e}")
        
        return text
    
    def _parse_pdf_text(self, text: str) -> Dict[str, Any]:
        """
        Parse extracted PDF text for benefits WITH LIMITS, coverage, pricing, and terms
        
        Enhanced to extract structured benefit data with numeric limits for frontend comparison
        
        Args:
            text: Extracted PDF text
        
        Returns:
            Dictionary with parsed details including benefit limits
        """
        details = {
            'benefits': [],
            'coverage': [],
            'pricing': 'Not specified',
            'terms': 'Not specified',
            'deductible': 0,
            'coInsurance': 0
        }
        
        if not text:
            return details
        
        # Split into lines for parsing
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        all_text = ' '.join(lines)
        
        # STEP 1: Extract pricing
        pricing_patterns = [
            r'(?:Annual\s+)?Premium[:\s]*AED\s*([\d,]+)',
            r'AED\s*([\d,]+)\s*(?:per\s+year|annually)',
            r'(?:Total|Price|Cost)[:\s]*AED\s*([\d,]+)',
            r'AED\s*([\d,]+)'
        ]
        
        for pattern in pricing_patterns:
            matches = re.findall(pattern, all_text, re.IGNORECASE)
            if matches:
                amounts = [int(m.replace(',', '')) for m in matches]
                if amounts:
                    max_amount = max(amounts)
                    if max_amount > 1000:
                        details['pricing'] = f"AED {max_amount:,}"
                        self.logger.info(f"💰 Found pricing in PDF: {details['pricing']}")
                        break
        
        # STEP 2: Extract deductible
        ded_patterns = [
            r'Deductible[:\s]*AED\s*([\d,]+)',
            r'Excess[:\s]*AED\s*([\d,]+)',
            r'Patient\s+pays\s+AED\s*([\d,]+)\s+(?:deductible|excess)'
        ]
        for pattern in ded_patterns:
            match = re.search(pattern, all_text, re.IGNORECASE)
            if match:
                details['deductible'] = int(match.group(1).replace(',', ''))
                self.logger.info(f"💳 Found deductible: AED {details['deductible']:,}")
                break
        
        # STEP 3: Extract co-insurance
        coins_patterns = [
            r'Co-?insurance[:\s]*([\d]+)%',
            r'Patient\s+pays[:\s]*([\d]+)%',
            r'(\d+)%\s+co-?insurance'
        ]
        for pattern in coins_patterns:
            match = re.search(pattern, all_text, re.IGNORECASE)
            if match:
                details['coInsurance'] = int(match.group(1))
                self.logger.info(f"💳 Found co-insurance: {details['coInsurance']}%")
                break
        
        # STEP 4: Extract benefits WITH LIMITS
        # Look for patterns like:
        # - "Hospital Room: AED 1,500 per night"
        # - "ICU coverage up to AED 3,000/day"
        # - "Maternity: Normal delivery AED 8,000"
        
        benefit_patterns = [
            # Pattern: "Name: AED amount per unit"
            r'([A-Za-z\s]+):\s*AED\s*([\d,]+)\s*(?:per\s+)?([a-z]+)?',
            # Pattern: "Name up to AED amount"
            r'([A-Za-z\s]+)\s+up to\s+AED\s*([\d,]+)',
            # Pattern: "Name AED amount"
            r'([A-Za-z\s]+)\s+AED\s*([\d,]+)',
            # Pattern: "Name covered at X%"
            r'([A-Za-z\s]+)\s+covered\s+at\s+(\d+)%',
            r'([A-Za-z\s]+)\s+(\d+)%\s+covered'
        ]
        
        for line in lines:
            # Skip very short lines or headers
            if len(line) < 10 or line.isupper():
                continue
            
            # Try each pattern
            for pattern in benefit_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    benefit_text = line
                    cleaned = clean_text(benefit_text)
                    
                    # Avoid duplicates
                    if cleaned and cleaned not in details['benefits']:
                        details['benefits'].append(cleaned)
                    break
        
        # STEP 5: If no structured benefits found, use keyword extraction
        if not details['benefits']:
            self.logger.warning("⚠️ No structured benefits found, trying keyword extraction...")
            
            benefit_keywords = [
                'inpatient', 'outpatient', 'emergency', 'surgery', 'consultation',
                'diagnostic', 'prescription', 'dental', 'optical', 'maternity',
                'room', 'icu', 'doctor', 'hospital', 'treatment', 'care',
                'delivery', 'ambulance', 'pharmacy', 'medication'
            ]
            
            for line in lines:
                line_lower = line.lower()
                if len(line) > 15 and any(kw in line_lower for kw in benefit_keywords):
                    # Check if line has any amount or percentage
                    if re.search(r'AED\s*[\d,]+|\d+%', line, re.IGNORECASE):
                        cleaned = clean_text(line)
                        if cleaned and cleaned not in details['benefits']:
                            details['benefits'].append(cleaned)
                            if len(details['benefits']) >= 40:
                                break
                    elif len(line) > 20:
                        # Even without amount, include if substantial
                        cleaned = clean_text(line)
                        if cleaned and cleaned not in details['benefits']:
                            details['benefits'].append(cleaned)
                            if len(details['benefits']) >= 40:
                                break
        
        # STEP 6: Extract terms
        term_indicators = ['terms', 'conditions', 'exclusions', 'waiting period']
        current_section = None
        
        for line in lines:
            line_lower = line.lower()
            
            if any(indicator in line_lower for indicator in term_indicators):
                current_section = 'terms'
                if details['terms'] == 'Not specified':
                    details['terms'] = ''
                continue
            
            if current_section == 'terms' and len(line) > 10:
                if details['terms']:
                    details['terms'] += " " + clean_text(line)
                else:
                    details['terms'] = clean_text(line)
                
                if len(details['terms']) > 500:
                    break
        
        # Limit and clean up
        details['benefits'] = details['benefits'][:40]
        details['coverage'] = details['coverage'][:30]
        if len(details['terms']) > 500:
            details['terms'] = details['terms'][:500] + "..."
        elif details['terms'] == '':
            details['terms'] = 'Not specified'
        
        self.logger.info(f"✅ Enhanced PDF parsing: {len(details['benefits'])} benefits with limits, "
                        f"deductible: AED {details['deductible']:,}, co-insurance: {details['coInsurance']}%")
        
        return details
    
    async def _extract_benefits_from_popup(self, popup: Page) -> List[str]:
        """
        Extract benefits from popup HTML
        """
        benefits = []
        
        try:
            # Try multiple selectors for benefits
            selectors = [
                'ul li',
                'ol li',
                'div:has-text("Benefit")',
                'div:has-text("Coverage")',
                'p',
                'div.benefit',
                'div.coverage'
            ]
            
            for selector in selectors:
                try:
                    elements = await popup.locator(selector).all()
                    if elements:
                        for elem in elements[:20]:  # Limit to 20 items
                            text = await elem.inner_text()
                            if text and len(text.strip()) > 3:
                                cleaned = clean_text(text)
                                if cleaned and cleaned not in benefits:
                                    benefits.append(cleaned)
                        
                        if len(benefits) > 0:
                            break
                except:
                    continue
        
        except Exception as e:
            self.logger.debug(f"Could not extract benefits: {e}")
        
        return benefits[:20]
    
    async def _extract_coverage_from_popup(self, popup: Page) -> List[str]:
        """Extract coverage details from popup HTML"""
        coverage = []
        
        try:
            # Look for coverage-related sections
            coverage_sections = await popup.locator('div:has-text("Coverage"), section:has-text("Coverage")').all()
            
            for section in coverage_sections:
                text = await section.inner_text()
                if text:
                    lines = text.split('\n')
                    for line in lines:
                        cleaned = clean_text(line)
                        if cleaned and len(cleaned) > 5:
                            coverage.append(cleaned)
        except Exception as e:
            self.logger.debug(f"Could not extract coverage: {e}")
        
        return coverage[:15]
    
    async def _extract_pricing_from_popup(self, popup: Page) -> str:
        """Extract pricing information from popup"""
        try:
            # Look for price-related elements
            price_elements = await popup.locator('span:has-text("AED"), div:has-text("AED"), p:has-text("AED")').all()
            
            for elem in price_elements:
                text = await elem.inner_text()
                if 'AED' in text:
                    return clean_text(text)
        except:
            pass
        
        return 'Not specified'
    
    async def _extract_terms_from_popup(self, popup: Page) -> str:
        """Extract terms and conditions from popup"""
        try:
            terms_elem = await popup.locator('div:has-text("Terms"), div:has-text("Conditions"), small, .terms').first
            
            if terms_elem:
                text = await terms_elem.inner_text()
                return clean_text(text)
        except:
            pass
        
        return 'Not specified'


