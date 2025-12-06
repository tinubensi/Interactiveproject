/**
 * Authentication Service - Function Exports
 * 
 * This file imports all function handlers to ensure they are registered
 * with the Azure Functions runtime.
 */

// Import all function handlers
import './functions/CallbackB2B';
import './functions/DeleteSession';
import './functions/GetMe';
import './functions/GetSessions';
import './functions/Health';
import './functions/Introspect';
import './functions/LoginB2B';
import './functions/Logout';
import './functions/LogoutAll';
import './functions/RefreshToken';

// Export for module resolution
export {};

