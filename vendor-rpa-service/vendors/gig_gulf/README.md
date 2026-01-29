# GIG Gulf Insurance Bot

Automated RPA bot for extracting insurance plans from GIG Gulf Insurance portal.

## Overview

This bot automates the process of:
1. Logging into the GIG Gulf Insurance portal
2. Filling the insurance quotation form
3. Extracting all available insurance plans with complete details
4. Parsing and structuring the data in StandardPlan format

## Structure

```
gig_gulf/
├── __init__.py          # Package initialization
├── config.json          # Bot configuration
├── bot.py               # Main bot logic (login, form filling)
├── scraper.py           # Plan extraction logic
├── parser.py            # Data parsing and transformation
├── adapter.py           # Data transformation (StandardLead ↔ vendor format)
├── cli.py               # CLI wrapper for Node.js integration
├── test_bot.py          # Test script
└── README.md            # This file
```

## Configuration

### config.json
```json
{
  "portalUrl": "https://health.gig-gulf.com/externalsso/ids/login?signin=...",
  "plansUrl": "https://health.gig-gulf.com/health/quotation/add",
  "enable_screenshots": true,
  "default_timeout": 60000,
  "navigation_timeout": 90000
}
```

### Credentials
Credentials are stored in `config/credentials.json`:

```json
{
  "vendor-gig-gulf": {
    "username": "IMEDICAL",
    "password": "Interactive@2025"
  }
}
```

## Usage

### As a standalone script

```bash
# Run the test script
cd /home/nipin/Desktop/CRM/Interactiveproject/vendor-rpa-service
python3 vendors/gig_gulf/test_bot.py
```

### Via CLI wrapper (from Node.js)

```bash
python3 vendors/gig_gulf/cli.py --lead-data '{"id":"lead-123","firstName":"John","lastName":"Doe",...}'
```

### Programmatic usage

```python
import asyncio
from vendors.gig_gulf.bot import Gig_gulfBot
from vendors.gig_gulf.adapter import Gig_gulfAdapter
from vendors.gig_gulf.scraper import Gig_gulfScraper

async def extract_plans(lead_data):
    # Initialize adapter
    adapter = Gig_gulfAdapter()
    vendor_payload = adapter.prepare_vendor_payload(lead_data)
    
    # Load credentials and config
    credentials = {...}  # Load from credentials.json
    config = {...}       # Load from config.json
    
    # Run bot
    async with Gig_gulfBot(credentials, config) as bot:
        await bot.navigate_to_portal()
        await bot.login()
        await bot.fill_insurance_form(vendor_payload)
        
        scraper = Gig_gulfScraper(bot.page, config, vendor_payload)
        plans = await scraper.extract_all_plans(bot)
        
        return plans

# Run
plans = asyncio.run(extract_plans(lead_data))
```

## Form Fields

The bot fills the following form fields:

| Field | Description | Example |
|-------|-------------|---------|
| Country | Country of residence | United Arab Emirates |
| First Name | Applicant's first name | Kane |
| Last Name | Applicant's last name | Williamson |
| Date of Birth | DOB in DD/MM/YYYY format | 18/03/1998 |
| Gender | Male/Female | Male |
| Marital Status | Single/Married/etc. | Single |
| Nationality | Nationality | Indian |
| State | Emirate | Abu Dhabi |
| Visa Location | Visa emirate | Abu Dhabi |
| Passport Country | Country of passport | India |
| Work Location | Work location in UAE | BUISNESS BAY |
| Occupation | Occupation | Accountant |
| Email | Contact email | test@gmail.com |
| Salary Range | Monthly salary range | >4000 and <=12000 AED/month |
| Visa Type | Type of visa | Resident visa |

## Data Extraction

The scraper extracts the following information for each plan:

- Plan Name
- Plan Code
- Annual Premium
- Monthly Premium
- Coverage Limits (Annual, Inpatient, Outpatient, etc.)
- Benefits (structured by category)
- Deductibles
- Co-insurance
- Waiting Periods
- Network and TPA information

## Output Format

Plans are returned in **StandardPlan** format:

```json
{
  "id": "plan-...",
  "type": "plan",
  "leadId": "lead-123",
  "vendorId": "vendor-gig-gulf",
  "vendorName": "GIG Gulf Insurance",
  "vendorCode": "GIG",
  "planName": "Premium Plan",
  "planCode": "GIG-PLA-PREMIUMPLAN",
  "planType": "standard",
  "annualPremium": 5000,
  "monthlyPremium": 416.67,
  "currency": "AED",
  "annualLimit": 500000,
  "benefits": [
    {
      "categoryId": "coverage",
      "categoryName": "Coverage Details",
      "benefits": [...]
    }
  ],
  "rawPlanData": {...}
}
```

## Testing

### Run the test script

```bash
cd /home/nipin/Desktop/CRM/Interactiveproject/vendor-rpa-service
python3 vendors/gig_gulf/test_bot.py
```

This will:
1. Load test lead data
2. Run the bot with `headless=False` (visible browser)
3. Extract all plans
4. Save results to `/tmp/gig_gulf_test_plans.json`
5. Display a summary

### Headless mode

To run in headless mode, edit `test_bot.py` and set:

```python
bot_config = {
    'headless': True,  # Changed from False
    ...
}
```

## Dependencies

- playwright
- python >= 3.8

Install dependencies:
```bash
pip install playwright
playwright install chromium
```

## Integration with Vendor Registry

The bot is automatically registered in the vendor registry. You can access it via:

```python
from vendors import vendor_registry

# Get bot class
BotClass = vendor_registry.get_bot('gig-gulf')  # or 'vendor-gig-gulf'

# Get adapter class
AdapterClass = vendor_registry.get_adapter('gig-gulf')

# Get config
config = vendor_registry.get_config('gig-gulf')
```

## Troubleshooting

### Bot fails to login
- Check credentials in `config/credentials.json`
- Verify the portal URL is correct
- Check if the login page structure has changed

### No plans extracted
- Check if the form submission was successful
- Verify the plans page loads correctly
- Enable screenshots to debug: `"enable_screenshots": true` in config.json
- Check logs for any error messages

### Screenshots location
Screenshots are saved to `/tmp/` with prefix `giggulf_`:
- `giggulf_login_page.png`
- `giggulf_before_submit.png`
- `giggulf_after_login.png`
- `giggulf_form_filled.png`
- `giggulf_plans_loaded.png`

## Notes

- The bot handles popup windows (quotation form opens in a new window)
- Form filling includes proper waits between actions for stability
- The scraper is designed to be flexible and handle various page structures
- All extracted data is cleaned and normalized to StandardPlan format
