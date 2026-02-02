"""
Alsagr Insurance Portal Bot
Specialized bot for Alsagr Insurance portal automation
"""
import asyncio
import re
from typing import Optional, Dict, Any
from playwright.async_api import Page
from vendors.base.vendor_bot import InsuranceBot
from vendors.base.utils import setup_logging, save_screenshot
from vendors.alsagr.adapter import map_emirate


class AlsagrBot(InsuranceBot):
    """
    Specialized bot for Alsagr Insurance portal
    Handles Alsagr-specific login flow and form navigation
    """
    
    def __init__(self, credentials: Dict[str, Any], config: Optional[Dict[str, Any]] = None):
        """
        Initialize the Alsagr Bot
        
        Args:
            credentials: Dictionary containing Alsagr portal credentials
            config: Optional configuration dictionary
        """
        super().__init__(credentials, config)
        self.logger.info("Alsagr Bot initialized")
    
    async def login(self):
        """
        Perform login to Alsagr portal
        Based on browser_actions.py lines 26-31
        """
        self.logger.info("Attempting Alsagr login...")
        
        try:
            # Get login URL from config
            login_url = self.config.get('portalUrl')
            
            if not login_url:
                raise ValueError("Login URL not found in config")
            
            self.logger.info(f"Navigating to login page: {login_url}")
            await self.page.goto(login_url, wait_until='domcontentloaded', timeout=60000)
            
            # Wait for login form to be visible
            await self.page.wait_for_selector('input', timeout=10000)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_login_page")
            
            # Fill Username
            self.logger.debug("Filling Username...")
            await self.page.get_by_role("textbox", name="User name").fill(self.credentials['username'])
            
            # Small delay for stability
            await asyncio.sleep(0.5)
            
            # Fill Password
            self.logger.debug("Filling Password...")
            await self.page.get_by_role("textbox", name="Password").fill(self.credentials['password'])
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_before_submit")
            
            # Click Log In button
            self.logger.debug("Clicking Log In button...")
            await self.page.get_by_role("button", name="Log In", exact=True).click()
            
            # Wait for navigation after login (redirect to quotationsearch)
            self.logger.debug("Waiting for redirect to quotation search...")
            await self.page.wait_for_url("**/quotationsearch", timeout=60000)
            
            # CRITICAL FIX: Explicit navigation if not already there (matching working script lines 37-38)
            current_url = self.page.url
            self.logger.debug(f"After login URL: {current_url}")
            
            if current_url != "https://miportal.alsagrins.ae/quotationsearch":
                self.logger.debug("Explicitly navigating to quotation search page...")
                await self.page.goto("https://miportal.alsagrins.ae/quotationsearch", wait_until='domcontentloaded', timeout=30000)
                await asyncio.sleep(1)  # Wait for page to stabilize
            
            self.logger.info("Alsagr login successful")
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_after_login")
        
        except Exception as e:
            self.logger.error(f"Alsagr login failed: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_login_error")
            raise
    
    async def fill_insurance_form(self, form_data: Dict[str, Any]):
        """
        Fill the insurance quotation form with user data
        Based on browser_actions.py lines 41-56
        
        Args:
            form_data: Dictionary containing form field values from adapter
        """
        self.logger.info("Starting Alsagr form filling process...")
        
        try:
            # Explicitly navigate to the quotation search page to ensure it's fully loaded
            # (matching original browser_actions.py lines 37-38)
            search_url = self.config.get('searchUrl', 'https://miportal.alsagrins.ae/quotationsearch')
            self.logger.debug(f"Ensuring we're on search page: {search_url}")
            
            if self.page.url != search_url:
                self.logger.debug(f"Navigating to search page explicitly...")
                try:
                    await self.page.goto(search_url, wait_until='domcontentloaded', timeout=30000)
                    # Try to wait for networkidle, but don't fail if it times out
                    try:
                        await self.page.wait_for_load_state('networkidle', timeout=10000)
                    except:
                        self.logger.debug("  networkidle timeout (OK - page may have background activity)")
                    await asyncio.sleep(1)
                except Exception as e:
                    self.logger.warning(f"Navigation issue: {e}, continuing anyway...")
            else:
                self.logger.debug("Already on search page, waiting for stability...")
                try:
                    await self.page.wait_for_load_state('networkidle', timeout=10000)
                except:
                    self.logger.debug("  networkidle timeout (OK - page may have background activity)")
                await asyncio.sleep(1)
            
            # Click "Generate Quick Quotation" button if it exists (optional - not always present)
            self.logger.debug("Looking for Generate Quick Quotation button...")
            try:
                # Try with leading space (matching working script line 41)
                await self.page.get_by_role("button", name=" Generate Quick Quotation").click(timeout=5000)
                self.logger.debug("✓ Clicked Generate Quick Quotation button")
            except Exception as e1:
                try:
                    # Try without leading space
                    self.logger.debug("  Retry without leading space...")
                    await self.page.get_by_role("button", name="Generate Quick Quotation").click(timeout=5000)
                    self.logger.debug("✓ Clicked Generate Quick Quotation button")
                except Exception as e2:
                    # Try with text locator as fallback
                    try:
                        self.logger.debug("  Retry with text locator...")
                        await self.page.locator("button:has-text('Generate Quick Quotation')").click(timeout=5000)
                        self.logger.debug("✓ Clicked Generate Quick Quotation button")
                    except Exception as e3:
                        # Button not found - that's OK, form might be directly accessible
                        self.logger.debug("  Generate Quick Quotation button not found (OK - form may be directly accessible)")
            await asyncio.sleep(1)
            
            # Fill form fields
            self.logger.debug("Filling form fields...")
            
            # Visa Emirate dropdown
            # Wait for dropdown to be ready
            self.logger.info("Waiting for Visa Emirate dropdown to be ready...")
            emirate_dropdown = self.page.locator("#visaEmirate")
            await emirate_dropdown.wait_for(state="visible", timeout=10000)
            await asyncio.sleep(0.5)  # Extra wait for dropdown to be fully loaded
            
            # Extract and log all available emirate options for debugging
            try:
                emirate_options = await emirate_dropdown.locator("option").all()
                self.logger.info("📋 Available Emirate Options in Portal:")
                for opt in emirate_options:
                    try:
                        value = await opt.get_attribute('value')
                        text = await opt.inner_text()
                        if value and value.strip() and text and text.strip() and text.strip() != '-Visa Emirate-':
                            self.logger.info(f"  {text.strip()} = {value.strip()}")
                    except:
                        continue
            except Exception as e:
                self.logger.warning(f"Could not extract emirate options: {e}")
            
            # Get emirate code from form data
            visa_emirate_code = form_data.get('visaEmirate', '13')  # Default to Dubai
            
            # If not a code, try to get emirate name and map it
            if not str(visa_emirate_code).isdigit():
                emirate_name = None
                if form_data.get('lobData', {}).get('emirate'):
                    emirate_name = form_data.get('lobData', {}).get('emirate')
                elif form_data.get('emirate'):
                    emirate_name = form_data.get('emirate')
                
                if emirate_name:
                    visa_emirate_code = map_emirate(emirate_name)
                    self.logger.info(f"Mapped emirate '{emirate_name}' to code: {visa_emirate_code}")
            
            self.logger.info(f"Selecting visa emirate: code={visa_emirate_code}")
            
            # Use direct select_option (as shown in Playwright recording - this works)
            await emirate_dropdown.select_option(visa_emirate_code, timeout=5000)
            
            # Verify selection
            selected_value = await emirate_dropdown.input_value()
            if selected_value == str(visa_emirate_code):
                self.logger.info(f"✅ Successfully selected emirate: code={visa_emirate_code}")
            else:
                self.logger.warning(f"⚠️ Selection verification: expected {visa_emirate_code}, got {selected_value}")
            
            await asyncio.sleep(0.3)  # Wait after selection
            
            # Visa Type dropdown (ONLY for Abu Dhabi and Al Ain)
            # IMPORTANT: Visa Type field only appears for emirates 11 (Abu Dhabi) and 313 (Al Ain)
            if visa_emirate_code in ['11', '313']:
                visa_type_code = form_data.get('visaType', '141')  # Default to Employee (141)
                self.logger.info(f"Visa type code from adapter: {visa_type_code} (required for emirate {visa_emirate_code})")
                
                # Map code to text for selection (CORRECTED based on portal HTML)
                visa_type_mapping = {
                    '281': 'Self Dependent',
                    '142': 'Employee',      # FIXED: was 'Domestic Visa Holder'
                    '141': 'Investor',      # FIXED: was 'Employee'
                    '143': 'Self Dependent' # appears to be duplicate
                }
                visa_type_text = visa_type_mapping.get(visa_type_code, 'Employee')
                self.logger.info(f"Selecting visa type by text: '{visa_type_text}'")
                
                try:
                    visa_type_dropdown = self.page.locator("#visaType")
                    await visa_type_dropdown.wait_for(state="visible", timeout=5000)
                    
                    # DEBUG: Log available options
                    try:
                        options = await visa_type_dropdown.locator('option').all_text_contents()
                        self.logger.debug(f"Available visa type options: {options}")
                    except:
                        pass
                    
                    # Select by LABEL (text) instead of value - more reliable
                    await visa_type_dropdown.select_option(label=visa_type_text, timeout=5000)
                    self.logger.info(f"✅ Successfully selected visa type: {visa_type_text} (code: {visa_type_code})")
                    
                    # Verify selection
                    try:
                        selected_value = await visa_type_dropdown.input_value()
                        selected_text = await visa_type_dropdown.locator(f'option[value="{selected_value}"]').inner_text()
                        self.logger.debug(f"✓ Verified visa type: {selected_text} (value: {selected_value})")
                    except:
                        pass
                    
                except Exception as e:
                    self.logger.error(f"❌ Could not select visa type '{visa_type_text}': {e}")
                    # Try fallback: select by value
                    try:
                        self.logger.warning(f"Trying fallback: selecting by value '{visa_type_code}'...")
                        await visa_type_dropdown.select_option(visa_type_code, timeout=5000)
                        self.logger.info(f"✅ Selected visa type by value: {visa_type_code}")
                    except Exception as e2:
                        self.logger.error(f"❌ Fallback also failed: {e2}")
                await asyncio.sleep(0.3)
            else:
                self.logger.info(f"Visa type not required for emirate {visa_emirate_code} (only needed for Abu Dhabi and Al Ain)")
            
            # Salary Band dropdown
            self.logger.info("Selecting salary band...")
            await self.page.locator("#salaryBandTypeId").select_option(form_data.get('salaryBand', '23'))
            await asyncio.sleep(0.3)
            
            # Extract primary member data
            primary = form_data.get('primary', form_data)  # Fallback to root if no 'primary' key
            dependents = form_data.get('dependents', [])
            
            # Fill primary member fields
            self.logger.debug(f"Filling primary member: {primary.get('firstName', 'Unknown')}")
            await self.page.get_by_role("textbox", name="First Name").fill(primary.get('firstName', primary.get('first_name', 'Guest')))
            await asyncio.sleep(0.2)
            
            await self.page.get_by_role("textbox", name="Last Name").fill(primary.get('lastName', primary.get('last_name', 'User')))
            await asyncio.sleep(0.2)
            
            # Date of Birth (date input type accepts YYYY-MM-DD format)
            await self.page.locator("#dateOfBirth").fill(primary.get('dateOfBirth', primary.get('dob', '2000-01-01')))
            await asyncio.sleep(0.3)
            
            # Gender dropdown
            await self.page.locator("#gender").select_option(primary.get('gender', '190'))
            await asyncio.sleep(0.3)
            
            # Marital Status dropdown - with fallback for portal changes
            marital_status_value = primary.get('maritalStatus', '21')
            try:
                await self.page.locator("#maritalStatus").select_option(marital_status_value, timeout=5000)
                self.logger.debug(f"Selected maritalStatus by value: {marital_status_value}")
            except Exception as e:
                self.logger.warning(f"Could not select maritalStatus by value, trying by label: {e}")
                try:
                    # Try selecting by visible text
                    marital_text = "Married" if marital_status_value == '20' else "Single"
                    await self.page.locator("#maritalStatus").select_option(label=marital_text, timeout=5000)
                    self.logger.debug(f"Selected maritalStatus by label: {marital_text}")
                except Exception as e2:
                    self.logger.error(f"Could not select maritalStatus at all, continuing anyway: {e2}")
            await asyncio.sleep(0.3)
            
            # Nationality dropdown - CRITICAL FIELD
            nationality_code = primary.get('nationalityCode', primary.get('nationality', '108'))  # Default to Indian (108)
            self.logger.info(f"Selecting nationality: {nationality_code}")
            try:
                # Check if nationality field exists first
                nationality_field = self.page.locator("#nationality")
                if await nationality_field.count() > 0:
                    await nationality_field.select_option(nationality_code, timeout=5000)
                    self.logger.info(f"✅ Successfully selected nationality: {nationality_code}")
                else:
                    self.logger.info(f"ℹ️  Nationality field not present on form (optional)")
            except Exception as e:
                self.logger.warning(f"Could not select nationality (field may be optional): {e}")
            await asyncio.sleep(0.3)
            
            # Occupation dropdown - OPTIONAL FIELD (not always present)
            occupation_code = primary.get('occupationCode', primary.get('occupation', '42'))  # Default to Engineer (42)
            self.logger.info(f"Checking for occupation field...")
            try:
                # Check if occupation field exists first
                occupation_field = self.page.locator("#occupation")
                if await occupation_field.count() > 0:
                    await occupation_field.select_option(occupation_code, timeout=5000)
                    self.logger.info(f"✅ Successfully selected occupation: {occupation_code}")
                else:
                    self.logger.info(f"ℹ️  Occupation field not present on form (optional for this scenario)")
            except Exception as e:
                self.logger.info(f"ℹ️  Occupation field not available (this is OK, field is optional): {e}")
            await asyncio.sleep(0.3)
            
            # Phone number
            await self.page.get_by_role("textbox", name="05X-XXXXXXX / 0X-XXXXXXX").fill(primary.get('phone', '0502503969'))
            await asyncio.sleep(0.2)
            
            # Email
            await self.page.get_by_role("textbox", name="Enter Email").fill(primary.get('email', 'demo@gmail.com'))
            await asyncio.sleep(0.3)
            
            # Effective Date - OPTIONAL FIELD (not always present)
            effective_date = primary.get('effectiveDate', form_data.get('effectiveDate', ''))
            if effective_date:
                self.logger.info(f"Checking for effective date field...")
                try:
                    # Check if effective date field exists first
                    effective_date_field = self.page.locator("#effectiveDate")
                    if await effective_date_field.count() > 0:
                        await effective_date_field.fill(effective_date, timeout=5000)
                        self.logger.info(f"✅ Successfully set effective date: {effective_date}")
                    else:
                        self.logger.info(f"ℹ️  Effective date field not present on form (optional for this scenario)")
                except Exception as e:
                    self.logger.info(f"ℹ️  Effective date field not available (this is OK, field is optional): {e}")
                await asyncio.sleep(0.3)
            
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_form_filled")
            
            # Handle "Single Member Policy" field BEFORE filling dependents
            # This is critical - the form won't submit if this isn't set correctly
            # Based on the page text, it shows "Single Member Policy? Yes No" as buttons
            has_dependents = len(dependents) > 0
            self.logger.debug(f"Single Member Policy? Has dependents: {has_dependents}")
            
            # Wait a bit for any background processes to settle
            self.logger.info("⏳ Waiting for form to stabilize before Single Member Policy...")
            await asyncio.sleep(3)  # Give form time to settle
            
            # Check if loading overlay exists and try to wait for it, but don't block
            try:
                is_loading_visible = await self.page.locator(".loading-progress-overlay").is_visible()
                if is_loading_visible:
                    self.logger.info("⏳ Loading overlay detected, waiting up to 10s...")
                    try:
                        await self.page.wait_for_selector(".loading-progress-overlay", state="hidden", timeout=10000)
                        self.logger.info("✓ Loading overlay hidden")
                        await asyncio.sleep(1)
                    except:
                        self.logger.warning("⚠️ Loading overlay still visible after 10s, will use force click")
                else:
                    self.logger.info("✓ No loading overlay blocking")
            except:
                pass
            
            # Set "Single Member Policy" - try buttons first (most common), then radio buttons
            if has_dependents:
                # Has dependents - select "No" to reveal dependent fields
                try:
                    self.logger.info("Selecting 'No' for Single Member Policy (has dependents)...")
                    # Try button first (most common in this portal)
                    await self.page.get_by_role("button", name="No").click(timeout=10000)
                    self.logger.debug("✓ Clicked 'No' button")
                    await asyncio.sleep(1)  # Wait for dependent fields to appear
                    
                    # Wait for dependent fields to be visible
                    try:
                        await self.page.locator("#memberFirstName1").wait_for(state="visible", timeout=5000)
                        self.logger.debug("✓ Dependent fields are visible")
                    except:
                        self.logger.warning("⚠️ Dependent fields not visible after clicking 'No'")
                        
                except Exception as e:
                    self.logger.warning(f"Could not click 'No' button: {e}, trying radio...")
                    try:
                        # Try radio button
                        await self.page.get_by_role("radio", name="No").click(timeout=10000)
                        self.logger.debug("✓ Clicked 'No' radio")
                        await asyncio.sleep(1)
                        try:
                            await self.page.locator("#memberFirstName1").wait_for(state="visible", timeout=5000)
                            self.logger.debug("✓ Dependent fields are visible")
                        except:
                            self.logger.warning("⚠️ Dependent fields not visible")
                    except Exception as e2:
                        self.logger.warning(f"Could not click 'No' radio: {e2}, trying input selector...")
                        try:
                            # Try input selector
                            await self.page.locator('input[type="radio"][value="No"]').click(timeout=10000)
                            self.logger.debug("✓ Clicked 'No' input")
                            await asyncio.sleep(1)
                            try:
                                await self.page.locator("#memberFirstName1").wait_for(state="visible", timeout=5000)
                                self.logger.debug("✓ Dependent fields are visible")
                            except:
                                self.logger.warning("⚠️ Dependent fields not visible")
                        except Exception as e3:
                            self.logger.error(f"All 'No' selectors failed. Last error: {e3}")
                            # Continue anyway - might work without it
            else:
                # No dependents - select "Yes"
                try:
                    self.logger.info("🔘 Selecting 'Yes' for Single Member Policy (no dependents)...")
                    # Try button first with force click as fallback
                    yes_button = self.page.get_by_role("button", name="Yes")
                    try:
                        await yes_button.click(timeout=5000)
                        self.logger.info("✅ Clicked 'Yes' button (normal click)")
                    except Exception as e_normal:
                        # Force click if normal click fails
                        self.logger.info(f"Normal click failed: {e_normal}, trying force click...")
                        await yes_button.click(force=True, timeout=5000)
                        self.logger.info("✅ Clicked 'Yes' button (force click)")
                    await asyncio.sleep(0.5)
                except Exception as e:
                    self.logger.warning(f"⚠️ Could not click 'Yes' button: {e}, trying radio...")
                    try:
                        await self.page.get_by_role("radio", name="Yes").click(force=True, timeout=10000)
                        self.logger.info("✅ Clicked 'Yes' radio button")
                        await asyncio.sleep(0.5)
                    except Exception as e2:
                        self.logger.warning(f"⚠️ Could not click 'Yes' radio: {e2}, trying input selector...")
                        try:
                            await self.page.locator('input[type="radio"][value="Yes"]').click(force=True, timeout=10000)
                            self.logger.info("✅ Clicked 'Yes' input radio")
                            await asyncio.sleep(0.5)
                        except Exception as e3:
                            self.logger.error(f"❌ ALL 'Yes' selectors failed!")
                            self.logger.error(f"   Button error: {e}")
                            self.logger.error(f"   Radio name error: {e2}")
                            self.logger.error(f"   Radio type error: {e3}")
                            raise Exception("Failed to click Single Member Policy 'Yes' button - form cannot be submitted")
            
            # NOW handle primary member in Row 1 and dependents - AFTER setting Single Member Policy
            # CRITICAL: Row 1 (#memberFirstName1, etc.) must be filled with PRIMARY member details
            # Then dependents go in Row 2, 3, etc.
            
            # Fill Row 1 with PRIMARY member details
            self.logger.info("Filling Row 1 with PRIMARY member details...")
            try:
                await self.page.locator("#memberFirstName1").fill(primary.get('firstName', primary.get('first_name', 'Guest')))
                self.logger.debug(f"  ✓ Filled Row 1 First Name: {primary.get('firstName', primary.get('first_name', 'Guest'))}")
                await asyncio.sleep(0.2)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to fill Row 1 First Name: {e}")
            
            try:
                await self.page.locator("#memberLastName1").fill(primary.get('lastName', primary.get('last_name', 'User')))
                self.logger.debug(f"  ✓ Filled Row 1 Last Name: {primary.get('lastName', primary.get('last_name', 'User'))}")
                await asyncio.sleep(0.2)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to fill Row 1 Last Name: {e}")
            
            try:
                await self.page.locator("#memberDateOfBirth1").fill(primary.get('dateOfBirth', primary.get('dob', '2000-01-01')))
                self.logger.debug(f"  ✓ Filled Row 1 Date of Birth: {primary.get('dateOfBirth', primary.get('dob', '2000-01-01'))}")
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to fill Row 1 Date of Birth: {e}")
            
            try:
                await self.page.locator("#memberGender1").select_option(primary.get('gender', '190'))
                self.logger.debug(f"  ✓ Selected Row 1 Gender: {primary.get('gender', '190')}")
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to select Row 1 Gender: {e}")
            
            try:
                marital_status_value = primary.get('maritalStatus', '21')
                await self.page.locator("#memberMaritalStatus1").select_option(marital_status_value)
                self.logger.debug(f"  ✓ Selected Row 1 Marital Status: {marital_status_value}")
                await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to select Row 1 Marital Status: {e}")
            
            # CRITICAL: Set relation to "Principal" for Row 1 (primary member)
            # Principal is between Spouse (48) and Parent (50) in the dropdown
            # So Principal is likely code 47 or 46
            try:
                # First, try to find Principal by searching through all options
                # This is the most reliable method
                relation_set = False
                try:
                    # Get all options from the dropdown
                    options = await self.page.locator("#relation1 option").all()
                    self.logger.debug(f"  Found {len(options)} relation options")
                    
                    for opt in options:
                        text = await opt.inner_text()
                        value = await opt.get_attribute('value')
                        text_lower = text.lower().strip()
                        
                        # Look for Principal (case-insensitive)
                        if 'principal' in text_lower and value and value != '48':  # Not Spouse
                            await self.page.locator("#relation1").select_option(value)
                            self.logger.info(f"  ✅ Selected Row 1 Relation: {text} (value: {value})")
                            relation_set = True
                            break
                    
                    if not relation_set:
                        self.logger.warning("  ⚠️ 'Principal' not found in options, trying codes...")
                except Exception as e:
                    self.logger.debug(f"  Could not search options: {e}")
                
                # Fallback: Try common Principal codes (between Spouse=48 and Parent=50)
                if not relation_set:
                    # Principal is likely 47 (between 48 and 50) or 46
                    principal_codes = ['47', '46']
                    for code in principal_codes:
                        try:
                            await self.page.locator("#relation1").select_option(code, timeout=3000)
                            selected_value = await self.page.locator("#relation1").input_value()
                            # Verify it's not Spouse (48) or Parent (50)
                            if selected_value not in ['48', '50']:
                                self.logger.info(f"  ✅ Selected Row 1 Relation: code {code} (value: {selected_value})")
                                relation_set = True
                                break
                        except:
                            continue
                
                if not relation_set:
                    self.logger.error("  ❌ FAILED to set Row 1 Relation to Principal - validation may fail!")
                else:
                    await asyncio.sleep(0.3)
            except Exception as e:
                self.logger.error(f"  ❌ Failed to select Row 1 Relation: {e}")
            
            self.logger.info("  ✅ Row 1 filled with PRIMARY member details (including Relation=Principal)")
            await asyncio.sleep(0.5)
            
            # NOW handle dependents (if any) - AFTER filling Row 1 with primary
            if has_dependents:
                self.logger.info(f"Adding {len(dependents)} dependent(s) in Row 2, 3, etc....")
                
                # Wait a bit for fields to be ready
                await asyncio.sleep(1)
                
                # Dependents go in Row 2, 3, etc. (Row 1 is already filled with primary)
                for idx, dependent in enumerate(dependents, start=1):
                    dep_name = f"{dependent.get('firstName', 'Unknown')} {dependent.get('lastName', '')}"
                    self.logger.info(f"Filling dependent #{idx}: {dep_name.strip()}")
                    
                    # CRITICAL: Click "Add New Member" FIRST to create a NEW row for this dependent
                    # Row 1 is for primary member - we need row 2, 3, etc. for dependents
                    # So dependent row index = idx + 1 (idx=1 → row 2, idx=2 → row 3, etc.)
                    dependent_row_idx = idx + 1
                    
                    self.logger.info(f"  🔘 Clicking 'Add New Member' button to create row #{dependent_row_idx} for dependent...")
                    clicked = await self._click_add_new_member_button()
                    
                    if not clicked:
                        self.logger.error(f"  ❌ FAILED to click 'Add New Member' for dependent #{idx}!")
                        self.logger.error(f"  ❌ Cannot create new row for dependent!")
                        continue
                    
                    self.logger.info(f"  ✅ Successfully clicked 'Add New Member' - waiting for row #{dependent_row_idx} to appear...")
                    await asyncio.sleep(2)  # Wait for new row to appear
                    
                    # Verify the new row fields are visible (row 2, 3, etc. - NOT row 1!)
                    try:
                        await self.page.locator(f"#memberFirstName{dependent_row_idx}").wait_for(state="visible", timeout=5000)
                        self.logger.debug(f"  ✓ Dependent row #{dependent_row_idx} is now visible")
                    except:
                        self.logger.warning(f"  ⚠️ Dependent row #{dependent_row_idx} not visible after clicking 'Add New Member'")
                    
                    # Fill dependent fields in the NEW row (row 2, 3, etc.)
                    try:
                        await self.page.locator(f"#memberFirstName{dependent_row_idx}").fill(dependent.get('firstName', ''))
                        self.logger.debug(f"  ✓ Filled First Name in row #{dependent_row_idx}: {dependent.get('firstName', '')}")
                        await asyncio.sleep(0.2)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to fill First Name: {e}")
                    
                    try:
                        await self.page.locator(f"#memberLastName{dependent_row_idx}").fill(dependent.get('lastName', ''))
                        self.logger.debug(f"  ✓ Filled Last Name in row #{dependent_row_idx}: {dependent.get('lastName', '')}")
                        await asyncio.sleep(0.2)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to fill Last Name: {e}")
                    
                    try:
                        # Date of Birth (date input type accepts YYYY-MM-DD format)
                        await self.page.locator(f"#memberDateOfBirth{dependent_row_idx}").fill(dependent.get('dateOfBirth', ''))
                        self.logger.debug(f"  ✓ Filled Date of Birth in row #{dependent_row_idx}: {dependent.get('dateOfBirth', '')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to fill Date of Birth: {e}")
                    
                    try:
                        await self.page.locator(f"#relation{dependent_row_idx}").select_option(dependent.get('relationshipCode', '49'))
                        self.logger.debug(f"  ✓ Selected Relation in row #{dependent_row_idx}: {dependent.get('relationshipCode', '49')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to select Relation: {e}")
                    
                    try:
                        await self.page.locator(f"#memberGender{dependent_row_idx}").select_option(dependent.get('genderCode', '190'))
                        self.logger.debug(f"  ✓ Selected Gender in row #{dependent_row_idx}: {dependent.get('genderCode', '190')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to select Gender: {e}")
                    
                    try:
                        await self.page.locator(f"#memberMaritalStatus{dependent_row_idx}").select_option(dependent.get('maritalStatusCode', '21'))
                        self.logger.debug(f"  ✓ Selected Marital Status in row #{dependent_row_idx}: {dependent.get('maritalStatusCode', '21')}")
                        await asyncio.sleep(0.3)
                    except Exception as e:
                        self.logger.error(f"  ❌ Failed to select Marital Status: {e}")
                    
                    # After filling all fields, the dependent should be in the table
                    self.logger.info(f"  ✓ Filled all fields for dependent #{idx} in row #{dependent_row_idx}")
                    await asyncio.sleep(1)  # Wait for form to register the dependent
            
            # CRITICAL: Verify dependents are in the member table before submitting
            if has_dependents:
                self.logger.info("🔍 Verifying dependents in member table before submission...")
                try:
                    # Wait a moment for table to update
                    await asyncio.sleep(1)
                    
                    # Check member table for dependent names
                    table_text = await self.page.locator("table").inner_text() if await self.page.locator("table").count() > 0 else ""
                    
                    if table_text:
                        dependent_found = False
                        for dep in dependents:
                            dep_first_name = dep.get('firstName', '').lower()
                            dep_last_name = dep.get('lastName', '').lower()
                            if dep_first_name and dep_first_name in table_text.lower():
                                dependent_found = True
                                self.logger.info(f"  ✅ Verified dependent '{dep_first_name} {dep_last_name}' in member table")
                                break
                        
                        if not dependent_found:
                            self.logger.warning("  ⚠️ Dependent not found in member table - may cause single member premium")
                            # Log table content for debugging
                            self.logger.debug(f"  Table content preview: {table_text[:200]}")
                    else:
                        self.logger.warning("  ⚠️ Member table not found - cannot verify dependents")
                except Exception as e:
                    self.logger.warning(f"  ⚠️ Could not verify dependents in table: {e}")
            
            # CRITICAL: Wait for loading overlay to disappear before clicking
            self.logger.info("⏳ Waiting for loading overlay to disappear...")
            try:
                await self.page.wait_for_selector(".loading-progress-overlay", state="hidden", timeout=30000)
                self.logger.info("✓ Loading overlay hidden")
            except Exception as e:
                self.logger.warning(f"Loading overlay check timed out: {e}")
            
            # Extra wait for form to stabilize
            await asyncio.sleep(2)
            
            # Click "Show Plans" button
            self.logger.info("🔘 Clicking Show Plans button...")
            try:
                # Try force click to bypass any remaining overlays
                await self.page.get_by_role("button", name="Show Plans").click(force=True, timeout=10000)
            except Exception as click_err:
                self.logger.warning(f"Force click failed, trying regular click: {click_err}")
                await self.page.get_by_role("button", name="Show Plans").click(timeout=10000)
            
            # Wait for plans to load
            self.logger.info("⏳ Waiting for page to load after Show Plans...")
            try:
                await self.page.wait_for_load_state("networkidle", timeout=30000)
            except Exception as wait_err:
                self.logger.warning(f"⚠️ networkidle wait failed (portal slow), continuing anyway: {wait_err}")
                # Wait a fixed time instead
                await asyncio.sleep(5)
            
            # Check for validation errors after clicking Show Plans
            has_validation_error = False
            try:
                validation_errors = await self.page.locator(".alert-danger, .error, .text-danger, .invalid-feedback").all_text_contents()
                if validation_errors:
                    self.logger.error(f"❌ VALIDATION ERRORS ON FORM: {validation_errors}")
                    has_validation_error = True
                
                # Also check page text for age validation errors (these might not have specific CSS classes)
                page_text = await self.page.inner_text("body")
                age_error_phrases = [
                    "cannot be less than 18",
                    "must be at least 18",
                    "Principal cannot be less than",
                    "minimum age",
                    "invalid date of birth"
                ]
                for phrase in age_error_phrases:
                    if phrase.lower() in page_text.lower():
                        self.logger.error(f"❌ AGE VALIDATION ERROR DETECTED: Found '{phrase}' in page text")
                        has_validation_error = True
                        break
                
                if has_validation_error:
                    # Take screenshot of validation errors
                    import time
                    screenshot_path = f"/tmp/alsagr_validation_error_{int(time.time())}.png"
                    await self.page.screenshot(path=screenshot_path, full_page=True)
                    self.logger.error(f"📸 Validation error screenshot: {screenshot_path}")
                    
                    # Check if we're still on the form page (didn't navigate to results)
                    current_url = self.page.url
                    if "quotationsearch" in current_url or "indicativequote" not in current_url:
                        self.logger.error(f"⚠️  Form submission blocked by validation errors. Still on form page: {current_url}")
                        # Continue anyway - scraper will detect no plans found
                    
            except Exception as e:
                self.logger.debug(f"No validation errors found (this is good): {e}")
            await asyncio.sleep(3)
            
        except Exception as e:
            self.logger.error(f"Failed to fill form: {e}")
            if self.config.get('enable_screenshots'):
                await save_screenshot(self.page, "alsagr_form_error")
            raise
    
    async def _click_add_new_member_button(self) -> bool:
        """
        Helper method to click the "Add New Member" button using multiple selector strategies
        Returns True if button was clicked successfully, False otherwise
        """
        try:
            # Method 1: Try by title attribute
            try:
                add_button = self.page.get_by_title("Add New Member")
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by title)")
                    return True
            except:
                pass
            
            # Method 2: Try by locator with title
            try:
                add_button = self.page.locator('button[title="Add New Member"]')
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by locator)")
                    return True
            except:
                pass
            
            # Method 3: Try by text content
            try:
                add_button = self.page.get_by_text("Add New Member", exact=False)
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by text)")
                    return True
            except:
                pass
            
            # Method 4: Try by role button with text pattern
            try:
                add_button = self.page.get_by_role("button", name=re.compile("Add.*Member", re.IGNORECASE))
                if await add_button.count() > 0:
                    await add_button.click(timeout=5000)
                    self.logger.debug("  ✓ Clicked 'Add New Member' (by role)")
                    return True
            except:
                pass
            
            # Method 5: Try by icon/plus button (common pattern)
            try:
                # Look for button with plus icon or add icon
                add_button = self.page.locator('button:has(svg), button[aria-label*="Add"], button[aria-label*="add"]')
                buttons = await add_button.all()
                for btn in buttons:
                    text = await btn.inner_text()
                    aria_label = await btn.get_attribute('aria-label') or ''
                    if 'add' in text.lower() or 'add' in aria_label.lower() or 'member' in text.lower():
                        await btn.click(timeout=5000)
                        self.logger.debug("  ✓ Clicked 'Add New Member' (by icon/aria-label)")
                        return True
            except:
                pass
            
            return False
        except Exception as e:
            self.logger.error(f"  ❌ Error in _click_add_new_member_button: {e}")
            return False
