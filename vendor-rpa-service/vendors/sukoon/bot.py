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
    
    async def _fill_member_form(self, member_data: Dict[str, Any], member_index: int):
        """
        Fill form fields for a single member (primary or dependent).
        
        Args:
            member_data: Dictionary containing member details (from adapter)
            member_index: Index of the member (0 for primary, 1+ for dependents)
        """
        self.logger.info(f"Filling form for member {member_index} ({member_data.get('relationship', 'Unknown')})")
        
        try:
            # ============ GENDER SELECTION ============
            gender = member_data.get('gender', 'male').lower()
            self.logger.debug(f"Setting gender to: {gender} for member {member_index}")
            
            gender_button_id = f"ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_btn{'Male' if gender == 'male' else 'Female'}_{member_index}"
            gender_selector = f"#{gender_button_id}"
            
            try:
                # Try with ID selector first
                await self.page.locator(gender_selector).click(timeout=10000)
            except Exception as e:
                self.logger.warning(f"Failed to click gender button with selector {gender_selector}: {e}")
                # Fallback: try finding button by row
                try:
                    row_selector = f"#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation"
                    if member_index == 0:
                        await self.page.get_by_role("button", name="Male" if gender == "male" else "Female").first.click()
                    else:
                        # For dependents, try to find in the specific row
                        await self.page.get_by_role("button", name="Male" if gender == "male" else "Female").nth(member_index).click()
                    self.logger.debug("Used fallback gender button selector")
                except Exception as fallback_error:
                    self.logger.error(f"All gender button selectors failed for member {member_index}: {fallback_error}")
                    raise
            
            await self.page.wait_for_timeout(500)
            
            # ============ DATE OF BIRTH ============
            dob_str = member_data.get('dob', '1996-06-15')
            try:
                dob = datetime.fromisoformat(dob_str.split('T')[0])
                birth_year = dob.year
                birth_month = dob.month - 1  # jQuery datepicker is 0-indexed
                birth_day = dob.day
            except Exception as e:
                self.logger.warning(f"Error parsing DOB '{dob_str}': {e}, using defaults")
                birth_year = 1990
                birth_month = 0  # January
                birth_day = 1
            
            # Click on date of birth field
            # First, close any open datepickers by clicking outside
            try:
                datepicker = self.page.locator("#ui-datepicker-div")
                if await datepicker.count() > 0 and await datepicker.is_visible():
                    # Click outside to close any open datepicker
                    await self.page.keyboard.press("Escape")
                    await self.page.wait_for_timeout(300)
            except:
                pass  # No datepicker open, continue
            
            # Use nth() selector based on member index - most reliable approach
            try:
                dob_fields = self.page.get_by_placeholder("Date of Birth")
                # Wait for the field to be visible
                dob_field = dob_fields.nth(member_index)
                await dob_field.wait_for(state="visible", timeout=5000)
                
                # Scroll the field into view if needed
                await dob_field.scroll_into_view_if_needed()
                await self.page.wait_for_timeout(200)
                
                await dob_field.click()
                self.logger.debug(f"Clicked DOB field for member {member_index}")
            except Exception as e:
                self.logger.error(f"Failed to click DOB field for member {member_index}: {e}")
                # Try alternative: use ID-based selector
                try:
                    # The ID pattern might be different, try a few variations
                    possible_ids = [
                        f"ctl00_ctl00_ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ctl{(member_index * 2) + 2:02d}_txtDOB",
                        f"ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_txtDOB_{member_index}"
                    ]
                    for field_id in possible_ids:
                        try:
                            field = self.page.locator(f"#{field_id}")
                            if await field.count() > 0:
                                await field.click()
                                self.logger.debug(f"Clicked DOB field for member {member_index} using ID selector")
                                break
                        except:
                            continue
                    else:
                        raise e  # Re-raise original error if all attempts failed
                except:
                    raise e  # Re-raise original error
            
            # Wait for datepicker to appear after clicking
            await self.page.wait_for_timeout(1000)
            
            # Wait for the datepicker to be visible
            # The datepicker div should appear after clicking the field
            try:
                await self.page.locator("#ui-datepicker-div").wait_for(state="visible", timeout=3000)
            except:
                self.logger.warning(f"Datepicker not visible immediately for member {member_index}, continuing anyway")
            
            # Select year and month in datepicker
            # Use the visible datepicker div - it should be the one associated with the clicked field
            try:
                datepicker = self.page.locator("#ui-datepicker-div")
                
                # Get all comboboxes in the datepicker
                comboboxes = datepicker.get_by_role("combobox")
                combobox_count = await comboboxes.count()
                
                if combobox_count >= 2:
                    # Standard datepicker: first is month, second is year
                    await comboboxes.nth(1).select_option(str(birth_year))
                    await self.page.wait_for_timeout(300)
                    await comboboxes.first.select_option(str(birth_month))
                    await self.page.wait_for_timeout(300)
                else:
                    # Fallback: try class-based selectors
                    self.logger.warning(f"Using fallback datepicker selectors for member {member_index}")
                    await self.page.locator(".ui-datepicker-year").first.select_option(str(birth_year))
                    await self.page.wait_for_timeout(300)
                    await self.page.locator(".ui-datepicker-month").first.select_option(str(birth_month))
                    await self.page.wait_for_timeout(300)
            except Exception as e:
                self.logger.error(f"Failed to select date in datepicker for member {member_index}: {e}")
                raise
            
            # Select day - wait for it to be visible and click
            try:
                day_link = self.page.get_by_role("link", name=str(birth_day), exact=True)
                await day_link.wait_for(state="visible", timeout=3000)
                await day_link.click()
                await self.page.wait_for_timeout(500)
                self.logger.debug(f"Set DOB for member {member_index}: {birth_year}-{birth_month+1}-{birth_day}")
            except Exception as e:
                self.logger.error(f"Failed to select day {birth_day} for member {member_index}: {e}")
                # Try alternative: click any link with the day number
                try:
                    await self.page.get_by_role("link", name=str(birth_day)).first.click()
                    await self.page.wait_for_timeout(500)
                    self.logger.debug(f"Set DOB for member {member_index} using fallback day selector")
                except:
                    raise
            
            # ============ MARITAL STATUS ============
            marital_status = member_data.get('maritalStatus', '1')
            marital_selector = f"#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlMaritialStatus_{member_index}"
            try:
                await self.page.locator(marital_selector).wait_for(state="visible", timeout=3000)
                await self.page.locator(marital_selector).select_option(marital_status)
                self.logger.debug(f"Set marital status: {marital_status} for member {member_index}")
            except Exception as e:
                self.logger.error(f"Failed to set marital status for member {member_index}: {e}")
                raise
            
            # ============ NATIONALITY ============
            nationality_guid = member_data.get('nationality', 'a275c17e-afe4-e611-80c9-005056bd7a8d')
            nationality_selector = f"#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlNationality_{member_index}"
            try:
                await self.page.locator(nationality_selector).wait_for(state="visible", timeout=3000)
                await self.page.locator(nationality_selector).select_option(nationality_guid)
                self.logger.debug(f"Set nationality for member {member_index}")
            except Exception as e:
                self.logger.error(f"Failed to set nationality for member {member_index}: {e}")
                raise
            
            # ============ RELATIONSHIP ============
            relationship = member_data.get('relationship', 'Self/Employee')
            relationship_selector = f"#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_ddlRelationship_{member_index}"
            try:
                await self.page.locator(relationship_selector).wait_for(state="visible", timeout=3000)
                await self.page.locator(relationship_selector).select_option(relationship)
                self.logger.debug(f"Set relationship: {relationship} for member {member_index}")
            except Exception as e:
                self.logger.error(f"Failed to set relationship for member {member_index}: {e}")
                raise
            
            self.logger.info(f"Successfully filled form for member {member_index}")
            
        except Exception as e:
            self.logger.error(f"Error filling form for member {member_index}: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, f"sukoon_member_{member_index}_error")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the insurance quotation form with user data.
        Supports both individual and family coverage (multiple members).
        
        Args:
            form_data: Dictionary containing form field values from adapter
                      Expected structure:
                      {
                          'leadId': 'lead-123',
                          'visaType': '1',
                          'members': [
                              {'index': 0, 'relationship': 'Self/Employee', ...},
                              {'index': 1, 'relationship': 'Spouse', ...},
                              ...
                          ]
                      }
        """
        self.logger.info("Starting Sukoon form filling process...")
        
        try:
            # ============ NAVIGATE TO CALCULATOR ============
            await self.page.get_by_role("button", name="Premium Calculator").click()
            await self.page.wait_for_timeout(1000)
            self.logger.debug("Opened Premium Calculator")
            
            # Click HealthPlus link
            await self.page.get_by_role("link", name="HealthPlus").click()
            await self.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(2000)
            self.logger.debug("Selected HealthPlus plan")
            
            # ============ SELECT VISA TYPE (applies to all members) ============
            visa_type = form_data.get('visaType', '5')  # Default to UAE/GCC National
            await self.page.locator("#ContentContainer_MainContent_ucQuickQuote_DropDownList1").select_option(visa_type)
            self.logger.debug(f"Selected visa type: {visa_type}")
            
            # ============ EXTRACT MEMBERS ARRAY ============
            members = form_data.get('members', [])
            
            # Fallback for backward compatibility (if old format is used)
            if not members and 'gender' in form_data:
                self.logger.warning("Using legacy single-member format, converting to members array")
                members = [{
                    'index': 0,
                    'relationship': 'Self/Employee',
                    'gender': form_data.get('gender', 'male'),
                    'dob': form_data.get('dob', '1996-06-15'),
                    'maritalStatus': form_data.get('maritalStatus', '1'),
                    'nationality': form_data.get('nationality', 'a275c17e-afe4-e611-80c9-005056bd7a8d'),
                    'isPrimary': True
                }]
            
            if not members:
                raise ValueError("No members data found in form_data")
            
            self.logger.info(f"Processing {len(members)} member(s)")
            
            # ============ FILL PRIMARY MEMBER (Index 0) ============
            await self._fill_member_form(members[0], 0)
            
            # ============ FILL DEPENDENTS (Index 1+) ============
            for idx in range(1, len(members)):
                # Click "Add Member" button to add a new member row
                self.logger.debug(f"Adding member slot {idx}...")
                
                # Find and click the "Add Member" button
                add_member_button = self.page.get_by_role("button", name="Add Member")
                await add_member_button.wait_for(state="visible", timeout=5000)
                await add_member_button.click()
                
                # Wait for page to process the addition and DOM to update
                await self.page.wait_for_timeout(2000)
                
                # Wait for the new row's fields to appear
                # Check for the gender button first (most reliable indicator)
                expected_gender = members[idx].get('gender', 'male').lower()
                gender_button_selector = f"#ContentContainer_MainContent_ucQuickQuote_grdPremiumCalculation_btn{'Male' if expected_gender == 'male' else 'Female'}_{idx}"
                
                try:
                    # Wait for the gender button to appear
                    await self.page.locator(gender_button_selector).wait_for(state="visible", timeout=10000)
                    self.logger.debug(f"Gender button for member {idx} is visible")
                except Exception as e:
                    self.logger.warning(f"Gender button not found for member {idx}, checking DOB field: {e}")
                    # Fallback: check DOB field
                    try:
                        dob_fields = self.page.get_by_placeholder("Date of Birth")
                        await dob_fields.nth(idx).wait_for(state="visible", timeout=5000)
                        self.logger.debug(f"DOB field for member {idx} is visible")
                    except Exception as e2:
                        self.logger.error(f"Row {idx} fields not appearing: {e2}")
                        await self.page.wait_for_timeout(3000)  # Extra wait
                
                # Fill the dependent's form
                await self._fill_member_form(members[idx], idx)
            
            # ============ SCREENSHOT BEFORE SUBMISSION ============
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_form_filled_all_members")
            
            # ============ CALCULATE PREMIUM ============
            await self.page.get_by_role("button", name="Calculate Premium").click()
            await self.page.wait_for_load_state("domcontentloaded", timeout=60000)
            await self.page.wait_for_timeout(3000)
            self.logger.info(f"Calculate Premium clicked for {len(members)} member(s) - waiting for results...")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_plans_loaded")
        
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "sukoon_form_error")
            raise
