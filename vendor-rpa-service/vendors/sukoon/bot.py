"""
Sukoon Insurance Portal Bot
Specialized bot for Sukoon Insurance portal automation
"""
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime
from playwright.async_api import Page, TimeoutError as PlaywrightTimeout
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot


class SukoonBot(InsuranceBot):
    """
    Specialized bot for Sukoon Insurance portal
    Handles Sukoon-specific login flow and form navigation
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Sukoon Bot
        
        Args:
            credentials: Dictionary containing Sukoon portal credentials
            config: Optional configuration dictionary
        """
        super().__init__(credentials, config)
        self.logger.info("Sukoon Bot initialized")
    
    async def login(self):
        """
        Perform login to Sukoon portal
        Adapted from standalone sukoon_bot.py lines 15-114
        """
        self.logger.info("Attempting Sukoon login...")
        
        try:
            # Get login URL from config
            login_url = self.config.get('portalUrl')
            
            if not login_url:
                raise ValueError("Login URL not found in config")
            
            self.logger.info(f"Navigating to login page: {login_url}")
            # Changed from 'load' to 'domcontentloaded' for better reliability
            await self.page.goto(login_url, wait_until='domcontentloaded', timeout=60000)
            
            # Wait for page to be fully loaded
            await self.page.wait_for_timeout(2000)
            
            # Wait for login form with multiple selector strategies
            self.logger.debug("Waiting for login form...")
            username_field = None
            password_field = None
            
            # Strategy 1: By placeholder
            if await self.page.get_by_placeholder("Username").count() > 0:
                username_field = self.page.get_by_placeholder("Username")
                password_field = self.page.get_by_placeholder("Password")
            # Strategy 2: By input type and name
            elif await self.page.locator('input[type="text"]').count() > 0:
                username_field = self.page.locator('input[type="text"]').first
                password_field = self.page.locator('input[type="password"]').first
            # Strategy 3: By any text input
            else:
                inputs = self.page.locator('input')
                username_field = inputs.first
                password_field = inputs.nth(1)
            
            if not username_field:
                raise Exception("Could not locate username field")
            
            # Fill username
            await username_field.wait_for(state="visible", timeout=10000)
            await username_field.click()
            await self.page.wait_for_timeout(500)
            await username_field.fill(self.credentials['username'])
            await self.page.wait_for_timeout(500)
            self.logger.debug(f"Filled username: {self.credentials['username']}")
            
            # Fill password
            await password_field.click()
            await self.page.wait_for_timeout(500)
            await password_field.fill(self.credentials['password'])
            await self.page.wait_for_timeout(500)
            self.logger.debug("Filled password")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_before_login")
            
            # Click sign in button
            sign_in_button = self.page.get_by_role("button", name="Sign in")
            if await sign_in_button.count() == 0:
                sign_in_button = self.page.locator('button:has-text("Sign in"), input[type="submit"]').first
            
            await sign_in_button.click()
            self.logger.debug("Clicked Sign in button")
            
            # Wait for navigation after login
            await self.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(3000)
            
            # Check if login was successful by looking for Premium Calculator
            try:
                await self.page.get_by_role("button", name="Premium Calculator").wait_for(state="visible", timeout=10000)
                self.logger.info("Sukoon login successful!")
            except:
                # Alternative check: see if we're no longer on the sign-in page
                current_url = self.page.url
                if "signin" not in current_url.lower():
                    self.logger.info("Sukoon login successful (URL changed)!")
                else:
                    raise Exception("Login failed - Premium Calculator button not found")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_after_login")
        
        except Exception as e:
            self.logger.error(f"Sukoon login failed: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_login_error")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the insurance quotation form with user data
        Adapted from standalone sukoon_bot.py lines 117-211
        
        Args:
            form_data: Dictionary containing form field values from adapter
        """
        self.logger.info("Starting Sukoon form filling process...")
        
        try:
            # Click Premium Calculator button
            await self.page.get_by_role("button", name="Premium Calculator").click()
            await self.page.wait_for_timeout(1000)
            self.logger.debug("Opened Premium Calculator")
            
            # Click HealthPlus link
            await self.page.get_by_role("link", name="HealthPlus").click()
            await self.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(2000)
            self.logger.debug("Selected HealthPlus plan")
            
            # Select visa type from form_data (mapped by adapter)
            visa_type = form_data.get('visaType', '5')  # Default to UAE/GCC National
            await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_DropDownList1").select_option(visa_type)
            self.logger.debug(f"Selected visa type: {visa_type}")
            
            # Click gender button (Male or Female)
            gender = form_data.get('gender', 'male').lower()
            self.logger.debug(f"Setting gender to: {gender}")
            if gender == "male":
                await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_btnMale_0").click()
            else:
                try:
                    await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_btnFemale_0").click()
                except:
                    self.logger.warning("Female button selector may need adjustment, trying fallback")
                    await self.page.get_by_role("button", name="Female").first.click()
            
            await self.page.wait_for_timeout(500)
            
            # Fill Date of Birth from form_data
            dob_str = form_data.get('dob', '1996-06-15')
            try:
                dob = datetime.fromisoformat(dob_str.split('T')[0])  # Handle ISO format
                birth_year = dob.year
                birth_month = dob.month - 1  # jQuery datepicker is 0-indexed
                birth_day = dob.day
            except:
                # Fallback to defaults
                current_year = datetime.now().year
                age = form_data.get('age', 30)
                birth_year = current_year - age
                birth_month = 5  # June (0-indexed)
                birth_day = 15
            
            # Click on date of birth field
            await self.page.get_by_placeholder("Date of Birth").click()
            await self.page.wait_for_timeout(500)
            
            # Select year in datepicker
            await self.page.locator("#ui-datepicker-div").get_by_role("combobox").nth(1).select_option(str(birth_year))
            await self.page.wait_for_timeout(300)
            
            # Select month
            await self.page.locator("#ui-datepicker-div").get_by_role("combobox").first.select_option(str(birth_month))
            await self.page.wait_for_timeout(300)
            
            # Select day
            await self.page.get_by_role("link", name=str(birth_day)).click()
            await self.page.wait_for_timeout(500)
            self.logger.debug(f"Set date of birth: {birth_year}-{birth_month+1}-{birth_day}")
            
            # Select Marital Status from form_data
            marital_status = form_data.get('maritalStatus', '1')  # Default to Single
            await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlMaritialStatus_0").select_option(marital_status)
            self.logger.debug(f"Set marital status: {marital_status}")
            
            # Select Nationality from form_data
            nationality_guid = form_data.get('nationality', 'a275c17e-afe4-e611-80c9-005056bd7a8d')  # Default to UAE
            await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlNationality_0").select_option(nationality_guid)
            self.logger.debug("Set nationality")
            
            # Select Relationship (Self/Employee)
            await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlRelationship_0").select_option("Self/Employee")
            self.logger.debug("Set relationship: Self/Employee")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_form_filled")
            
            # Click Calculate Premium button
            await self.page.get_by_role("button", name="Calculate Premium").click()
            await self.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(3000)
            self.logger.info("Calculate Premium clicked - waiting for results...")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_plans_loaded")
        
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_form_error")
            raise
