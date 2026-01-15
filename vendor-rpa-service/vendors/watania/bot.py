"""
Watania Insurance Portal Bot
Specialized bot for Watania Insurance portal with custom login and navigation
"""

import asyncio
import re
import time
from typing import Optional, Dict, Any, List
from playwright.async_api import Page, Browser, BrowserContext
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot


class WataniaBot(InsuranceBot):
    """
    Specialized bot for Watania Insurance portal
    Handles Watania-specific login flow and navigation
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Watania Bot
        
        Args:
            credentials: Dictionary containing Watania portal credentials
            config: Optional configuration dictionary
        """
        super().__init__(credentials, config)
        self.logger.info("Watania Bot initialized")
        self.popup_pages: List[Page] = []
    
    async def login(self):
        """
        Perform login to Watania portal using placeholder selectors
        """
        self.logger.info("Attempting Watania login...")
        
        try:
            # FIXED: Get login URL from config, not credentials
            login_url = self.config.get('authUrl') or self.config.get('portalUrl')
            
            if not login_url:
                raise ValueError("Login URL not found in config")
            
            self.logger.info(f"Navigating to login page: {login_url}")
            await self.page.goto(login_url, wait_until='networkidle')
            
            # Wait for login form to be visible
            await self.page.wait_for_selector('input', timeout=10000)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_login_page")
            
            # Fill Login ID using placeholder selector
            self.logger.debug("Filling Login ID...")
            await self.page.get_by_placeholder("Login ID").fill(self.credentials['username'])
            
            # Small delay for better stability
            await asyncio.sleep(0.5)
            
            # Fill Password using placeholder selector
            self.logger.debug("Filling Password...")
            await self.page.get_by_placeholder("Password").fill(self.credentials['password'])
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_before_submit")
            
            # Click Submit button
            self.logger.debug("Clicking Submit button...")
            await self.page.get_by_role("button", name="Submit").click()
            
            # Wait for navigation after login
            await self.page.wait_for_load_state('networkidle', timeout=30000)
            
            # Wait briefly for redirects
            await asyncio.sleep(1)
            
            self.logger.info("Watania login successful")
            
            # Check for Account Locked popup
            try:
                # Wait briefly to see if lock popup appears
                account_locked = await self.page.get_by_text("Your Account is Locked").or_(
                    self.page.get_by_text("exceeded maximum trials")
                ).is_visible(timeout=5000)
                
                if account_locked:
                    self.logger.error("❌ CRITICAL: Watania Account is Locked!")
                    if self.config.get('enable_screenshots'):
                        await save_screenshot(self.page, "watania_account_locked")
                    raise Exception("Watania Account is Locked! Please contact admin.")
            except Exception as e:
                # If checking for lock fails (timeout), assume safe to proceed unless it was the lock exception
                if "Account is Locked" in str(e):
                    raise
                pass

            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_after_login")
        
        except Exception as e:
            self.logger.error(f"Watania login failed: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_login_error")
            raise
    
    async def navigate_to_form_from_dashboard(self):
        """
        Navigate from dashboard to the insurance form using UI clicks
        """
        self.logger.info("Navigating from dashboard to form...")
        
        try:
            # Wait briefly for dashboard
            await asyncio.sleep(1)
            
            # Click on Medical Insurance link/image
            self.logger.debug("Clicking on Medical Insurance...")
            try:
                # Try text selector first (more robust)
                await self.page.locator("text=Medical").first.click(timeout=5000)
            except:
                try:
                    # Try finding by heading
                    await self.page.get_by_role("heading", name="Medical").click(timeout=5000)
                except:
                    # Fallback to original image selector
                    self.logger.debug("Text selector failed, trying image...")
                    await self.page.locator("app-bb-home").get_by_role("img").click()
            
            await asyncio.sleep(0.5)
            
            # Click Submit button
            self.logger.debug("Clicking first Submit...")
            await self.page.get_by_role("button", name="Submit").click()
            await asyncio.sleep(1)
            
            # Click Buy button (4th one - nth(3))
            self.logger.debug("Clicking Buy button...")
            await self.page.get_by_text("Buy").nth(3).click()
            await asyncio.sleep(0.5)
            
            # Click Submit button again
            self.logger.debug("Clicking second Submit...")
            await self.page.get_by_role("button", name="Submit").click()
            await asyncio.sleep(1)
            
            self.logger.info("Successfully navigated to form")
            
        except Exception as e:
            self.logger.error(f"Failed to navigate to form: {e}")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the multi-step insurance form with user data
        
        Args:
            form_data: Dictionary containing form field values
        """
        self.logger.info("Starting form filling process...")
        
        try:
            # Wait for form to be ready
            await asyncio.sleep(2)
            
            # Step 1: Wait for form to be ready
            self.logger.debug("Waiting for form elements...")
            await self.page.wait_for_selector('text="Select Covered For"', timeout=15000)
            
            # Step 2: Select Coverage Type
            self.logger.debug("Selecting covered for...")
            await self.page.get_by_text("Select Covered For").click()
            await asyncio.sleep(0.5)
            await self.page.get_by_role("link", name=form_data.get('covered_for', 'Self'), exact=True).click()
            await asyncio.sleep(1)
            
            # Step 3: Fill Personal Information
            self.logger.debug("Filling personal information...")
            
            # Emirates ID
            await self.page.get_by_placeholder("Enter Emirates ID/Application").fill(form_data.get('emirates_id', ''))
            
            # Full Name
            await self.page.get_by_placeholder("Enter Full Name").fill(form_data.get('full_name', ''))
            
            # Email
            await self.page.get_by_placeholder("Enter Email ID").fill(form_data.get('email', ''))
            
            # Mobile
            await self.page.get_by_placeholder("Enter Mobile Number").fill(form_data.get('mobile', ''))
            
            # City - Improved with better error handling
            try:
                await self.page.locator("div").filter(has_text=re.compile(r"^Select City$")).nth(2).click()
                await asyncio.sleep(1)  # Give dropdown time to populate
                
                city_name = form_data.get('city', 'Ajman')
                self.logger.info(f"Attempting to select city: {city_name}")
                
                # Try exact match first
                try:
                    await self.page.get_by_role("link", name=city_name).click(timeout=5000)
                    self.logger.info(f"✅ Selected city: {city_name}")
                except:
                    # If exact match fails, try partial match (case-insensitive)
                    self.logger.warning(f"Exact match failed for '{city_name}', trying partial match...")
                    await self.page.get_by_role("link").filter(has_text=city_name).first.click(timeout=5000)
                    self.logger.info(f"✅ Selected city using partial match: {city_name}")
                
                await asyncio.sleep(0.5)
                
            except Exception as e:
                self.logger.error(f"❌ Failed to select city '{city_name}': {e}")
                # Take screenshot for debugging
                if self.config.get('enable_screenshots'):
                    screenshot_path = f"/app/screenshots/city_error_{int(time.time())}.png"
                    try:
                        await self.page.screenshot(path=screenshot_path)
                        self.logger.info(f"Screenshot saved: {screenshot_path}")
                    except:
                        pass
                # Try a fallback - select first available city
                try:
                    self.logger.warning("⚠️ Attempting fallback: selecting first city option")
                    await self.page.get_by_role("link").first.click(timeout=5000)
                    self.logger.info("✅ Used first city option as fallback")
                except:
                    raise Exception(f"Could not select any city option. Original error: {e}")
            
            # Salary - Improved with better error handling
            try:
                await self.page.locator("div").filter(has_text=re.compile(r"^Select Salary$")).nth(2).click()
                await asyncio.sleep(1)
                
                salary = form_data.get('salary', 'Less than or equal to AED')
                self.logger.info(f"Attempting to select salary: {salary}")
                
                try:
                    await self.page.get_by_role("link", name=salary).click(timeout=5000)
                    self.logger.info(f"✅ Selected salary: {salary}")
                except:
                    self.logger.warning(f"Exact match failed for salary, trying partial match...")
                    await self.page.get_by_role("link").filter(has_text=salary).first.click(timeout=5000)
                    self.logger.info(f"✅ Selected salary using partial match")
                
                await asyncio.sleep(0.5)
                
            except Exception as e:
                self.logger.error(f"❌ Failed to select salary: {e}")
                try:
                    await self.page.get_by_role("link").first.click(timeout=5000)
                    self.logger.warning("⚠️ Used first salary option as fallback")
                except:
                    raise Exception(f"Could not select salary option. Error: {e}")
            
            # Date of Birth
            await self.page.get_by_label("Date input field").click()
            await self.page.get_by_label("Date input field").fill(form_data.get('date_of_birth', ''))
            await asyncio.sleep(0.3)
            
            # Nationality - Improved with better error handling
            try:
                await self.page.get_by_text("Select Nationality").click()
                await asyncio.sleep(1)
                
                nationality = form_data.get('nationality', 'United Arab Emirates')
                self.logger.info(f"Attempting to select nationality: {nationality}")
                
                try:
                    await self.page.get_by_role("link", name=nationality).click(timeout=5000)
                    self.logger.info(f"✅ Selected nationality: {nationality}")
                except:
                    self.logger.warning(f"Exact match failed for nationality, trying partial match...")
                    await self.page.get_by_role("link").filter(has_text=nationality).first.click(timeout=5000)
                    self.logger.info(f"✅ Selected nationality using partial match")
                
                await asyncio.sleep(0.5)
                
            except Exception as e:
                self.logger.error(f"❌ Failed to select nationality: {e}")
                try:
                    await self.page.get_by_role("link").first.click(timeout=5000)
                    self.logger.warning("⚠️ Used first nationality option as fallback")
                except:
                    raise Exception(f"Could not select nationality option. Error: {e}")
            
            # Marital Status - Improved with better error handling
            try:
                await self.page.get_by_text("Select Marital Status").click()
                await asyncio.sleep(1)
                
                marital_status = form_data.get('marital_status', 'Single')
                self.logger.info(f"Attempting to select marital status: {marital_status}")
                
                try:
                    await self.page.get_by_role("link", name=marital_status).click(timeout=5000)
                    self.logger.info(f"✅ Selected marital status: {marital_status}")
                except:
                    self.logger.warning(f"Exact match failed for marital status, trying partial match...")
                    await self.page.get_by_role("link").filter(has_text=marital_status).first.click(timeout=5000)
                    self.logger.info(f"✅ Selected marital status using partial match")
                
                await asyncio.sleep(0.5)
                
            except Exception as e:
                self.logger.error(f"❌ Failed to select marital status: {e}")
                try:
                    await self.page.get_by_role("link").first.click(timeout=5000)
                    self.logger.warning("⚠️ Used first marital status option as fallback")
                except:
                    raise Exception(f"Could not select marital status option. Error: {e}")
            
            # Gender
            await self.page.get_by_text("Select Gender Status").click()
            await asyncio.sleep(0.3)
            await self.page.get_by_role("link", name=form_data.get('gender', 'Male'), exact=True).click()
            await asyncio.sleep(0.3)
            
            # Member Type - Handle Expat residency disambiguation
            member_type = form_data.get('member_type', 'UAE National')
            await self.page.get_by_text("Select Member Type").click()
            await asyncio.sleep(0.3)
            
            if member_type == 'Expat':
                # Disambiguate between Dubai and non-Dubai residency
                residency_emirate = form_data.get('residency_emirate', 'Dubai')
                if residency_emirate == 'Dubai':
                    full_member_type = 'Expat who is residency is issued in Dubai'
                else:
                    full_member_type = 'Expat who is residency is issued in Emirates other than Dubai'
                
                self.logger.info(f"Selecting Expat member type: {full_member_type}")
                
                try:
                    await self.page.get_by_role("link", name=full_member_type).first.click(timeout=5000)
                    self.logger.info(f"✅ Selected member type: {full_member_type}")
                except Exception as e:
                    self.logger.error(f"❌ Failed to select {full_member_type}, trying partial match...")
                    await self.page.get_by_role("link").filter(has_text="Expat").first.click()
                    self.logger.warning("⚠️ Used partial match for Expat selection")
            else:
                # UAE National or GCC National - no disambiguation needed
                await self.page.get_by_role("link", name=member_type).click()
                self.logger.info(f"✅ Selected member type: {member_type}")
            
            await asyncio.sleep(0.3)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_form_page1")
            
            # Click Next to go to page 2
            self.logger.debug("Moving to form page 2...")
            await self.page.get_by_role("button", name="Next").click()
            await asyncio.sleep(1)
            
            # Step 4: Fill Additional Information (Page 2)
            self.logger.debug("Filling additional information...")
            
            # Visa Type
            await self.page.locator("span").filter(has_text="Select Visa Type").first.click()
            await asyncio.sleep(0.3)
            await self.page.get_by_role("link", name=form_data.get('visa_type', 'Employment')).click()
            await asyncio.sleep(0.3)
            
            # Residential Location
            await self.page.get_by_text("Select Residential Location").click()
            await asyncio.sleep(0.3)
            await self.page.get_by_role("link", name=form_data.get('residential_location', 'Dubai')).click()
            await asyncio.sleep(0.3)
            
            # Currently Insured
            await self.page.get_by_text("Select Is Currently Insured?").click()
            await asyncio.sleep(0.3)
            await self.page.get_by_role("link", name=form_data.get('currently_insured', 'No')).click()
            await asyncio.sleep(0.3)
            
            # Passport Number
            await self.page.get_by_placeholder("Enter Passport Number").fill(form_data.get('passport_number', ''))
            
            # Visa File Number
            await self.page.get_by_placeholder("Enter Visa File Number").fill(form_data.get('visa_file_number', ''))
            
            # Visa Expiry Date
            await self.page.get_by_label("Date input field").click()
            await self.page.get_by_label("Date input field").fill(form_data.get('visa_expiry_date', ''))
            await asyncio.sleep(0.3)
            
            # Member UID
            await self.page.get_by_placeholder("Enter Member UID").fill(form_data.get('member_uid', ''))
            
            # Address
            await self.page.get_by_placeholder("Enter Address").fill(form_data.get('address', ''))
            await asyncio.sleep(0.3)
            
            # Handle checkbox/agreement
            try:
                await self.page.get_by_role("emphasis").nth(1).click()
                await asyncio.sleep(0.3)
                await self.page.get_by_role("button", name="OK").click()
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.debug(f"Agreement checkbox handling: {e}")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_form_page2")
            
            # Click Next to submit form
            self.logger.debug("Submitting form...")
            await self.page.get_by_role("button", name="Next").click()
            await asyncio.sleep(2)
            
            # Wait for plans page to load
            await self.page.wait_for_load_state('networkidle', timeout=30000)
            await asyncio.sleep(1)
            
            self.logger.info("Form filled successfully")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_after_form")
            
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_form_error")
            raise
    
    async def navigate_to_plans_page(self):
        """
        Navigate directly to the Watania plans listing page
        (Use this only if form filling is not required)
        """
        plans_url = self.credentials.get('plans_url', 'https://connect.watania.ae/#/NoorMedical/plan-list-details')
        
        self.logger.info(f"Navigating to Watania plans page: {plans_url}")
        
        try:
            await self.page.goto(plans_url, wait_until='networkidle', timeout=30000)
            
            # Wait for plans to load
            await asyncio.sleep(3)
            
            self.logger.info("Successfully navigated to plans page")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_plans_page")
        
        except Exception as e:
            self.logger.error(f"Failed to navigate to plans page: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "watania_plans_nav_error")
            raise
    
    async def get_plan_count(self) -> int:
        """
        Get the count of available plans
        
        Returns:
            Number of plans available
        """
        try:
            # Wait for Choose buttons to appear with much longer timeout (portal is slow)
            self.logger.info("⏳ Waiting for plans to load (up to 120 seconds)...")
            await self.page.wait_for_selector('button:has-text("Choose")', timeout=120000)
            
            # Get all Choose buttons
            choose_buttons = await self.page.get_by_role("button", name="Choose").count()
            
            self.logger.info(f"Found {choose_buttons} plans")
            return choose_buttons
        
        except Exception as e:
            self.logger.warning(f"Could not count plans: {e}")
            return 0
    
    async def click_choose_button(self, index: int):
        """
        Click the Choose button for a specific plan
        
        Args:
            index: Index of the plan (0-based)
        """
        self.logger.debug(f"Clicking Choose button for plan {index + 1}")
        
        try:
            choose_button = self.page.get_by_role("button", name="Choose").nth(index)
            await choose_button.click()
            
            # Wait for sub-plans to appear
            await asyncio.sleep(2)
            
            self.logger.debug(f"Choose button clicked for plan {index + 1}")
        
        except Exception as e:
            self.logger.error(f"Failed to click Choose button {index}: {e}")
            raise
    
    async def get_sub_plan_elements(self) -> List:
        """
        Get all sub-plan elements after clicking Choose
        
        Returns:
            List of sub-plan element locators
        """
        try:
            # Look for elements with class names containing plan information
            # Based on the recording: Class A NE1 (0-45) V4, etc.
            
            # Wait for sub-plans to be visible
            await asyncio.sleep(1)
            
            # Get all info icon elements that open popups
            info_icons = await self.page.locator("i").all()
            
            self.logger.debug(f"Found {len(info_icons)} potential sub-plan info icons")
            return info_icons
        
        except Exception as e:
            self.logger.error(f"Failed to get sub-plan elements: {e}")
            return []
    
    async def click_info_icon_and_get_popup(self, icon_element) -> Optional[Page]:
        """
        Click an info icon and capture the popup window
        
        Args:
            icon_element: The info icon element to click
        
        Returns:
            The popup page object, or None if failed
        """
        try:
            # Set up popup handler before clicking
            async with self.page.expect_popup(timeout=10000) as popup_info:
                await icon_element.click()
            
            popup = await popup_info.value
            
            # Wait for popup to load
            await popup.wait_for_load_state('networkidle')
            await asyncio.sleep(1)
            
            self.popup_pages.append(popup)
            
            self.logger.debug("Popup opened successfully")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(popup, f"watania_popup_{len(self.popup_pages)}")
            
            return popup
        
        except Exception as e:
            self.logger.warning(f"Failed to open popup: {e}")
            return None
    
    async def close_popup(self, popup: Page):
        """
        Close a popup window
        
        Args:
            popup: The popup page to close
        """
        try:
            await popup.close()
            if popup in self.popup_pages:
                self.popup_pages.remove(popup)
            self.logger.debug("Popup closed")
        except Exception as e:
            self.logger.warning(f"Failed to close popup: {e}")
    
    async def close_all_popups(self):
        """
        Close all open popup windows
        """
        for popup in self.popup_pages[:]:
            await self.close_popup(popup)
        self.popup_pages.clear()
    
    async def go_back_to_plans_list(self):
        """
        Navigate back to the plans listing page
        """
        plans_url = self.credentials.get('plans_url', 'https://connect.watania.ae/#/NoorMedical/plan-list-details')
        
        try:
            await self.page.goto(plans_url, wait_until='networkidle')
            await asyncio.sleep(2)
            self.logger.debug("Navigated back to plans list")
        except Exception as e:
            self.logger.error(f"Failed to navigate back: {e}")
    
    async def close(self):
        """
        Close the browser and cleanup resources, including all popups
        """
        # Close all popup windows first
        await self.close_all_popups()
        
        # Call parent close
        await super().close()

