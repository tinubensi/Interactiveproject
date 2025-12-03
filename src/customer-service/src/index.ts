// Entry point for Azure Functions
// This file imports all functions to ensure they are registered

// Auth functions
require('./src/functions/auth/signup');
require('./src/functions/auth/login');
require('./src/functions/auth/verifyOtp');

// Customer functions
require('./src/functions/customers/listCustomers');
require('./src/functions/customers/getCustomer');
require('./src/functions/customers/updateProfile');
require('./src/functions/customers/addContact');

// Integration functions
require('./src/functions/integrations/getPolicies');

// Event handlers
require('./src/functions/events/handlePolicyIssued');
require('./src/functions/events/handleDocumentUploaded');
require('./src/functions/events/handleDocumentExpired');

// Debug functions
require('./src/functions/debug/envCheck');
