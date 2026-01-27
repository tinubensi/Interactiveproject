# Admin Consent URLs for Multi-Tenant Setup

## Configuration Details
- **Client ID:** `e6800d2f-7a25-4a04-98f8-8a2dd697dec9`
- **Redirect URI:** `https://func-nectaria-authentication-dev.azurewebsites.net/api/auth/callback/b2b`

## Tenant 1: Nectaria Business Solutions
**Tenant ID:** `8e233b2c-7c85-4780-a36d-8c5744284951`

### Admin Consent URL:
```
https://login.microsoftonline.com/8e233b2c-7c85-4780-a36d-8c5744284951/adminconsent?client_id=e6800d2f-7a25-4a04-98f8-8a2dd697dec9&redirect_uri=https://func-nectaria-authentication-dev.azurewebsites.net/api/auth/callback/b2b
```

**Clickable Link:**
https://login.microsoftonline.com/8e233b2c-7c85-4780-a36d-8c5744284951/adminconsent?client_id=e6800d2f-7a25-4a04-98f8-8a2dd697dec9&redirect_uri=https://func-nectaria-authentication-dev.azurewebsites.net/api/auth/callback/b2b

---

## Tenant 2: IIB
**Tenant ID:** `08a4fcb1-3ebc-40b4-9079-c3ad9101ba84`

### Admin Consent URL:
```
https://login.microsoftonline.com/08a4fcb1-3ebc-40b4-9079-c3ad9101ba84/adminconsent?client_id=e6800d2f-7a25-4a04-98f8-8a2dd697dec9&redirect_uri=https://func-nectaria-authentication-dev.azurewebsites.net/api/auth/callback/b2b
```

**Clickable Link:**
https://login.microsoftonline.com/08a4fcb1-3ebc-40b4-9079-c3ad9101ba84/adminconsent?client_id=e6800d2f-7a25-4a04-98f8-8a2dd697dec9&redirect_uri=https://func-nectaria-authentication-dev.azurewebsites.net/api/auth/callback/b2b

---

## Instructions

1. **For Nectaria Business Solutions:**
   - Have a Global Administrator from the Nectaria Business Solutions tenant visit the first URL above
   - They will be prompted to grant admin consent for the application
   - After consenting, they will be redirected to the callback URL

2. **For IIB:**
   - Have a Global Administrator from the IIB tenant visit the second URL above
   - They will be prompted to grant admin consent for the application
   - After consenting, they will be redirected to the callback URL

3. **After Admin Consent:**
   - Users from both tenants will be able to sign in to the application
   - The application will validate that users belong to one of the allowed tenants (configured in `AZURE_AD_ALLOWED_TENANT_IDS`)

## Notes

- Admin consent must be granted by a **Global Administrator** or **Privileged Role Administrator** in each tenant
- The consent grants the application permissions to read user profiles and sign in users from that tenant
- Once consent is granted, it applies to all users in that tenant (unless restricted by conditional access policies)
- The redirect URI must match exactly what's configured in the Azure AD app registration
