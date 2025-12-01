// Entry point for Azure Functions
// This file imports all functions to ensure they are registered

// Auth functions
import './functions/auth/signup';
import './functions/auth/login';
import './functions/auth/verifyOtp';

// Customer functions
import './functions/customers/getCustomer';
import './functions/customers/updateProfile';
import './functions/customers/addContact';

// Integration functions
import './functions/integrations/getPolicies';

// Event handlers
import './functions/events/handlePolicyIssued';
import './functions/events/handleDocumentUploaded';
import './functions/events/handleDocumentExpired';
