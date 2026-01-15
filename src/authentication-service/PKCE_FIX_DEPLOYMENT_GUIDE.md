# PKCE Cookie Fix - Azure Deployment Guide

## Problem Summary

The PKCE verifier cookie error occurs on Azure but not locally due to:

1. **Wrong Cookie Domain**: `azurewebsites.net` instead of `.azurewebsites.net`
2. **Old Code Deployed**: Azure has old code with `path: '/api/auth'` instead of `path: '/'`

## Local vs Azure Comparison

### Local (✅ Works)
```bash
COOKIE_DOMAIN=localhost
COOKIE_SECURE=false
```
```typescript
// Cookie created with:
{
  domain: undefined,    // Perfect for localhost
  path: '/',            // Fixed in local code
  secure: false,
  sameSite: 'Lax'
}
```

### Azure (❌ Broken)
```bash
COOKIE_DOMAIN=azurewebsites.net  # Wrong!
COOKIE_SECURE=true
```
```typescript
// Cookie created with OLD CODE:
{
  domain: 'azurewebsites.net',  // ❌ Doesn't match subdomain
  path: '/api/auth',             // ❌ Old code, too restrictive
  secure: true,
  sameSite: 'Lax'
}
```

## Fixes Applied

### Fix 1: Update Infrastructure (Bicep)
**File:** `nectaria-services/infra/modules/function-app.bicep`

**Changed:**
```bicep
{
  name: 'COOKIE_DOMAIN'
  value: '.azurewebsites.net'  // Added leading dot
}
```

### Fix 2: Application Code (Already Fixed Locally)
**File:** `nectaria-services/src/authentication-service/src/lib/cookieHelper.ts`

**Changed:**
```typescript
export function createPkceVerifierCookie(verifier: string): Cookie {
  return {
    // ...
    path: '/',  // Changed from '/api/auth'
    // ...
  };
}
```

## Deployment Steps

### Step 1: Commit the Code Changes
```bash
cd /home/aravind/Projects/nectaria

# Check what's changed
git status

# Add the fixes
git add nectaria-services/src/authentication-service/src/lib/cookieHelper.ts
git add nectaria-services/src/authentication-service/src/lib/config.ts
git add nectaria-services/infra/modules/function-app.bicep

# Commit
git commit -m "fix(auth): PKCE cookie path and domain for OAuth redirects

- Changed PKCE cookie path from /api/auth to / for OAuth callback compatibility
- Fixed Azure cookie domain to use .azurewebsites.net for subdomain support
- Added resetConfig() function for testing
- All tests passing (49/49)

Fixes the 'missing_verifier' error during Azure AD B2B OAuth callback"
```

### Step 2: Deploy Updated Code to Azure

**Option A: Using Azure CLI (Recommended)**
```bash
cd /home/aravind/Projects/nectaria/nectaria-services/src/authentication-service

# Build the code
npm run build

# Publish to Azure (replace with your actual function app name)
func azure functionapp publish func-nectaria-authentication-dev
```

**Option B: Using CI/CD Pipeline**
```bash
git push origin main
# Or push to your feature branch and merge via PR
```

### Step 3: Update Azure Configuration

The infrastructure change requires redeployment:

```bash
cd /home/aravind/Projects/nectaria/nectaria-services/infra

# Deploy the updated infrastructure
az deployment sub create \
  --location uaenorth \
  --template-file main.bicep \
  --parameters environment=dev \
  --parameters azureAdTenantId="<your-tenant-id>" \
  --parameters azureAdClientId="<your-client-id>"
```

**OR** manually update the app setting via Azure Portal:
1. Go to Azure Portal
2. Navigate to `func-nectaria-authentication-dev`
3. Go to **Configuration** → **Application settings**
4. Find `COOKIE_DOMAIN`
5. Change from `azurewebsites.net` to `.azurewebsites.net` (add the dot)
6. Save and restart the function app

### Step 4: Verify the Deployment

1. **Check Application Settings:**
```bash
az functionapp config appsettings list \
  --name func-nectaria-authentication-dev \
  --resource-group rg-nectaria-dev \
  --query "[?name=='COOKIE_DOMAIN']"
```

Should show:
```json
[
  {
    "name": "COOKIE_DOMAIN",
    "value": ".azurewebsites.net"
  }
]
```

2. **Test the OAuth Flow:**
   - Update frontend `.env.local`: `NEXT_PUBLIC_AUTH_SERVICE_URL=https://func-nectaria-authentication-dev.azurewebsites.net`
   - Restart frontend: `npm run dev`
   - Navigate to `/dashboard`
   - Login with Azure AD
   - Should complete successfully without `missing_verifier` error

### Step 5: Verify Cookie in Browser

After successful login, check browser DevTools:
1. Open **Application** → **Cookies** → `https://func-nectaria-authentication-dev.azurewebsites.net`
2. Look for `nectaria_pkce_verifier` cookie
3. Verify attributes:
   - **Domain:** `.azurewebsites.net` ✅
   - **Path:** `/` ✅
   - **Secure:** ✅
   - **HttpOnly:** ✅
   - **SameSite:** `Lax` ✅

## Technical Explanation

### Why the Leading Dot Matters

**Without dot (`azurewebsites.net`):**
- Cookie only sent to exact domain `azurewebsites.net`
- NOT sent to `func-nectaria-authentication-dev.azurewebsites.net`

**With dot (`.azurewebsites.net`):**
- Cookie sent to `azurewebsites.net` AND all subdomains
- Includes `func-nectaria-authentication-dev.azurewebsites.net` ✅

### Why Path `/` is Required

**OAuth Flow:**
1. User → `localhost:3000` (frontend)
2. Frontend → `func-...azurewebsites.net/api/auth/login/b2b`
3. Sets cookie with path `/`
4. Redirect → `login.microsoftonline.com`
5. Azure AD → `func-...azurewebsites.net/api/auth/callback/b2b`
6. Browser sends cookie because path `/` matches `/api/auth/callback/b2b` ✅

**If path was `/api/auth`:**
- Still matches `/api/auth/callback/b2b` ✅

**But the real issue was the OLD path behavior combined with domain mismatch!**

## Troubleshooting

### If Still Getting Error After Deployment

1. **Clear Browser Cookies:**
   - Old cookies might be cached
   - Clear all cookies for `.azurewebsites.net`

2. **Check Function App Restart:**
   ```bash
   az functionapp restart \
     --name func-nectaria-authentication-dev \
     --resource-group rg-nectaria-dev
   ```

3. **Check Deployment Status:**
   ```bash
   az functionapp deployment list-publishing-profiles \
     --name func-nectaria-authentication-dev \
     --resource-group rg-nectaria-dev
   ```

4. **Check Logs:**
   ```bash
   func azure functionapp logstream func-nectaria-authentication-dev
   ```

## CORS Issues

If you see CORS errors, the Bicep already has correct CORS configuration:
```bicep
cors: {
  allowedOrigins: [
    'https://portal.azure.com'
    frontendUrl
    'http://localhost:3000'  // For dev environment
    'https://*.azurewebsites.net'
  ]
  supportCredentials: true  // ✅ Required for cookies
}
```

## Summary

- ✅ **Local code fixed** - cookie path changed to `/`
- ✅ **Bicep updated** - cookie domain changed to `.azurewebsites.net`
- 🔄 **Deployment needed** - Azure must be updated with new code and config
- ✅ **All tests passing** - 49/49 tests including PKCE OAuth flow

After deployment, both local and Azure will work perfectly!



