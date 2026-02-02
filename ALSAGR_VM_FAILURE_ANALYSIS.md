# Alsagr VM Failure Analysis & Fix

**Date:** 2026-01-30  
**Issue:** Bot returned 0 plans in VM but worked locally  
**Status:** 🟡 **ROOT CAUSE IDENTIFIED + FIXED**

---

## 🔍 Root Cause: Invalid Date of Birth in Production Data

The VM run failed because the lead had an **invalid date of birth**:

```json
"dateOfBirth": "2026-01-06"  // ❌ Year 2026 (future date!)
```

### What Happened:

1. ✅ Bot logged in successfully
2. ✅ Form filled successfully  
3. ❌ **Validation error**: "Principal cannot be less than 18 years of age"
4. ❌ Form submission blocked - stayed on form page
5. ❌ Scraper tried to find plans on form page → **0 plans found**

### Screenshot Evidence:

VM Screenshot (`/tmp/alsagr_no_plans_1769782228.png`) shows:
- Still on the form page (not results page)
- Red error text: "Principal cannot be less than 18 years of age" (appears twice)
- Date field shows `01/06/2026` (0 years old)
- "Show Plans" button still visible

---

## 🔧 Fixes Applied

### Fix 1: Better Validation Error Detection (`bot.py`)

**Before:** Only checked CSS classes for errors
```python
validation_errors = await self.page.locator(".alert-danger, .error, .text-danger").all_text_contents()
```

**After:** Also checks page text for age validation errors
```python
# Check CSS classes
validation_errors = await self.page.locator(".alert-danger, .error, .text-danger, .invalid-feedback").all_text_contents()

# PLUS check page text for age validation phrases
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
        self.logger.error(f"❌ AGE VALIDATION ERROR DETECTED")
        # Take screenshot and log
```

### Fix 2: Date of Birth Validation (`adapter.py`)

**Added:** Pre-validation before sending to portal
```python
# Validate date of birth (must be in the past and at least 18 years old)
if dob:
    dob_date = datetime.strptime(str(dob), '%Y-%m-%d')
    today = datetime.now()
    min_dob = today - timedelta(days=18*365)
    
    if dob_date > today:
        # Date is in the FUTURE
        print(f"⚠️  WARNING: Date of birth {dob} is in the FUTURE! Using default: 2000-01-01")
        dob = '2000-01-01'  # Use safe default
    elif dob_date > min_dob:
        # Person is less than 18
        print(f"⚠️  WARNING: Date of birth {dob} makes person less than 18 years old!")
        dob = '2000-01-01'  # Use safe default
```

---

## ✅ Why It Worked Locally

My local test used **valid data**:
```json
"dateOfBirth": "2000-01-06"  // ✅ 26 years old
```

Production lead had **invalid data**:
```json
"dateOfBirth": "2026-01-06"  // ❌ 0 years old (future!)
```

---

## 🎯 Action Items

### Immediate (Bot Side) - ✅ DONE
1. ✅ Better validation error detection
2. ✅ Date validation in adapter
3. ✅ Default to safe values when data is invalid

### Required (Frontend/Data Side) - ⚠️ MUST FIX
1. **Check lead form date picker** - Why is it allowing year 2026?
2. **Add frontend validation** - Date of birth must be:
   - In the past (< today)
   - At least 18 years ago
3. **Review existing leads** - Check if other leads have this issue:
   ```sql
   SELECT * FROM leads 
   WHERE dateOfBirth > CURRENT_DATE 
   OR dateOfBirth > DATE_SUB(CURRENT_DATE, INTERVAL 18 YEAR)
   ```

---

## 🧪 Testing

### Test with corrected data:
```json
{
  "formData": {
    "dateOfBirth": "2000-01-06",  // ✅ Changed from 2026 to 2000
    "firstName": "Glady",
    "lastName": "Doe",
    // ... rest same
  }
}
```

**Expected Result:** Form submits → Plans extracted successfully

---

## 📝 Summary

| Issue | Status |
|-------|--------|
| Bot hanging on "All Plan Types" | ✅ FIXED (earlier) |
| Adapter not reading formData | ✅ FIXED (earlier) |
| Invalid date of birth in data | ⚠️ **DATA ISSUE - FIX FRONTEND** |
| Bot not detecting age validation | ✅ FIXED (now) |
| No fallback for invalid dates | ✅ FIXED (now) |

The bot will now:
- ✅ Detect age validation errors
- ✅ Use safe defaults for invalid dates
- ✅ Take screenshots of validation errors
- ✅ Log warnings when data is corrected

**But the root cause is DATA QUALITY** - the lead form should not allow future dates or ages < 18!
