# Fix FRONTEND_URL Configuration

## Problem
The quotation email links are pointing to `ww25.your-frontend-url.com` which is a placeholder URL. This needs to be updated to your actual frontend URL.

**Important**: Azure production environments cannot use `localhost:3000` because:
- Email recipients won't be able to access localhost URLs
- Localhost only works on your local machine, not for external users
- You MUST set a production URL (e.g., Vercel deployment URL) in Azure Portal

## Solution

### Step 1: Find Your Frontend URL
Your frontend is likely deployed on:
- **Vercel**: Check your Vercel dashboard for the production URL (e.g., `https://your-app.vercel.app`)
- **Other hosting**: Use your production domain

### Step 2: Update Azure Function App Configuration

1. **Go to Azure Portal**: https://portal.azure.com

2. **Navigate to your Quotation Service Function App**:
   - Search for: `quotation-service-74e1210c` (or your function app name)
   - Click on the Function App

3. **Go to Configuration**:
   - In the left sidebar, click **"Configuration"**
   - Under **"Application settings"**, look for `FRONTEND_URL`

4. **Update FRONTEND_URL**:
   - If it exists, click the **pencil icon** to edit
   - If it doesn't exist, click **"+ New application setting"**
   - **Name**: `FRONTEND_URL`
   - **Value**: Your actual frontend URL (e.g., `https://your-app.vercel.app`)
     - ⚠️ **Important**: Do NOT include a trailing slash
     - ✅ Correct: `https://your-app.vercel.app`
     - ❌ Wrong: `https://your-app.vercel.app/`

5. **Save**:
   - Click **"Save"** at the top
   - Wait for the save to complete (may take a few seconds)

6. **Restart Function App** (if needed):
   - Go to **"Overview"** in the left sidebar
   - Click **"Restart"** button
   - Confirm the restart

### Step 3: Verify

1. **Test sending a quotation**:
   - Send a test quotation from your frontend
   - Check the email you receive
   - The "View Quotation & Select Plan" link should now point to your correct frontend URL

2. **Check Function Logs**:
   - Go to **"Functions"** in the left sidebar
   - Click on `sendQuotation` function
   - Go to **"Monitor"** tab
   - Check recent invocations for the log message: `Review link: https://your-correct-url.com/quotations/review/...`

## Example URLs

- **Vercel**: `https://crm-frontend-abc123.vercel.app`
- **Custom Domain**: `https://app.yourdomain.com`
- **Local Development**: `http://localhost:3000` (only for local testing - NOT valid in Azure production)

⚠️ **Important**: 
- `localhost:3000` is ONLY for local development
- Azure production MUST use a publicly accessible URL (Vercel, custom domain, etc.)
- The code will now automatically detect Azure environment and reject localhost URLs

## Troubleshooting

### If the link still shows the wrong URL:
1. Make sure you saved the configuration in Azure
2. Restart the Function App
3. Wait a few minutes for changes to propagate
4. Check that you didn't include a trailing slash in the URL

### If you get an error when sending:
- Check the Function App logs for error messages
- Verify the FRONTEND_URL is set correctly in Azure Portal
- Make sure the URL is accessible (not behind authentication that blocks the link)

## Code Changes Made

The code now validates the FRONTEND_URL and will return an error if it detects a placeholder URL, preventing emails from being sent with broken links.

