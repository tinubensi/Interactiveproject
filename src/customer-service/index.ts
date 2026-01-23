// Entry point for Azure Functions
// This file imports all functions to ensure they are registered

// Auth functions
import './src/functions/auth/signup';
import './src/functions/auth/login';
import './src/functions/auth/verifyOtp';

// Customer functions
import './src/functions/customers/listCustomers';
import './src/functions/customers/getCustomer';
import './src/functions/customers/updateProfile';
import './src/functions/customers/addContact';

// Integration functions
import './src/functions/integrations/getPolicies';

// Event handlers
import './src/functions/events/handlePolicyIssued';
import './src/functions/events/handleDocumentUploaded';
import './src/functions/events/handleDocumentExpired';

// Debug functions
import './src/functions/debug/envCheck';
