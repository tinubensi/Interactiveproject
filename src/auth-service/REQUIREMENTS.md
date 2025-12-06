# Auth Service Requirements

## ⚠️ DEPRECATION NOTICE

**This service has been modularized into four separate services for better separation of concerns and maintainability.**

The original `auth-service` requirements have been split into:

| Service | Path | Description |
|---------|------|-------------|
| **Authentication Service** | [`../authentication-service/REQUIREMENTS.md`](../authentication-service/REQUIREMENTS.md) | Token management, session handling, B2B SSO |
| **Authorization Service** | [`../authorization-service/REQUIREMENTS.md`](../authorization-service/REQUIREMENTS.md) | RBAC, permission checks, role management |
| **Audit Service** | [`../audit-service/REQUIREMENTS.md`](../audit-service/REQUIREMENTS.md) | Event logging, compliance reporting |
| **Staff Management Service** | [`../staff-management-service/REQUIREMENTS.md`](../staff-management-service/REQUIREMENTS.md) | Staff CRUD, teams, territories, workload |

---

## Migration Status

| Feature | Original Location | New Service | Status |
|---------|-------------------|-------------|--------|
| OTP Login | `customer-service/auth/login.ts` | Authentication Service | 🔄 Pending |
| Signup | `customer-service/auth/signup.ts` | Authentication Service | 🔄 Pending |
| Token Validation | N/A | Authentication Service | 🔄 Pending |
| Session Management | N/A | Authentication Service | 🔄 Pending |
| B2B SSO | N/A | Authentication Service | 🔄 Pending |
| Permission Checks | `form-service/lib/auth.ts` | Authorization Service | 🔄 Pending |
| Role Management | N/A | Authorization Service | 🔄 Pending |
| Audit Logging | N/A | Audit Service | 🔄 Pending |
| Staff Management | N/A | Staff Management Service | 🔄 Pending |

---

## Recommended Actions

1. **Do NOT use this `auth-service` directory for new development**
2. Use the modularized services for their respective concerns
3. Refer to individual service REQUIREMENTS.md files for detailed specifications
4. This directory may be removed after full migration is complete

---

## Quick Reference

### Authentication Service
- B2B SSO (Azure AD / Entra ID)
- Token issuance and refresh
- Session management
- Token introspection API

### Authorization Service
- Role-Based Access Control (RBAC)
- Permission definitions
- User-role assignments
- Permission checking middleware

### Audit Service
- Event logging from all services
- Compliance reporting
- Search and export capabilities

### Staff Management Service
- Staff CRUD operations
- Team management
- Territory assignments
- Workload tracking

---

**Document Version**: 2.0  
**Created**: December 3, 2025  
**Status**: DEPRECATED (Modularized)

