# Salary Field Update - Database Migration

## Summary
This updates the `monthlySalaryRange` field in form templates to use **portal codes** instead of text descriptions.

### Changes:
- **Old Format:** `"Less than 5000"`, `"5000-10000"`, etc.
- **New Format:** `"22"` (portal code), `"23"`, `"24"`

### Portal Codes (Alsagr Standard):
- `22` = Less than 4,000 AED
- `23` = 4,000 - 12,000 AED (DEFAULT)
- `24` = Greater than 12,000 AED

---

## Files Updated:

### ✅ Frontend (Customer Creation) - DONE
- `frontend/src/components/forms/individual-signup-form.tsx`
- Updated dropdown options to use portal codes

### ⚠️ Backend (Lead Creation Forms) - REQUIRES DB UPDATE
- Form templates stored in **Cosmos DB** need updating
- Run the migration script below

---

## How to Update Database:

### 1. **Get Cosmos DB Connection String**
```bash
# From Azure Portal or local.settings.json
export COSMOS_CONNECTION_STRING="AccountEndpoint=https://..."
```

### 2. **Navigate to form-service directory**
```bash
cd Interactiveproject/src/form-service
```

### 3. **Install dependencies (if needed)**
```bash
npm install
```

### 4. **Run the update script**
```bash
npx ts-node update_salary_field.ts
```

### 5. **Verify the output**
The script will:
- Find all MEDICAL insurance form templates
- Update existing salary fields with new options
- Add salary field if missing
- Show detailed logs of changes

---

## Expected Output:
```
🔍 Searching for medical insurance form templates...

✅ Found 2 medical insurance template(s)

📝 Processing: Medical Insurance - Individual (medical-individual-form-v2)
   🔄 Updating existing salary field in section "Medical Details"
      Old options: ["Less than 5000","5000-10000","10000-20000"]
      New options: ["22","23","24"]
   ✅ Template updated successfully

🎉 All templates processed successfully!
```

---

## Backend Adapter Changes:

The adapter (`vendors/alsagr/adapter.py`) has been updated to:
1. **Prioritize portal codes** (`22`, `23`, `24`)
2. **Support legacy text formats** for backward compatibility
3. **Look for `monthlySalaryRange`** in both `formData` and `lobData`

---

## Testing:

After running the script:
1. ✅ Create a new customer (should use portal codes)
2. ✅ Create a new lead (should use portal codes)
3. ✅ Trigger Alsagr bot - verify correct salary band selected
4. ✅ Check logs for: `"✓ Using portal code directly: 23"`

---

## Rollback:

If issues occur, you can:
1. Restore form templates from backup
2. Or re-run with old options:
   ```typescript
   options: [
     { label: "Less than 5000", value: "Less than 5000" },
     ...
   ]
   ```

---

## Questions?
Contact the development team or check:
- `frontend/src/components/forms/individual-signup-form.tsx` (frontend)
- `vendors/alsagr/adapter.py` (backend)
- `vendors/alsagr/bot.py` (RPA bot)
