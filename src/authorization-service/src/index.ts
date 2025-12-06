/**
 * Authorization Service - Function Exports
 * 
 * This file imports all function handlers to ensure they are registered
 * with the Azure Functions runtime.
 */

// Import permission functions
import './functions/CheckPermission';
import './functions/CheckResourcePermission';
import './functions/GetUserPermissions';
import './functions/Health';

// Import role functions
import './functions/roles/CreateRole';
import './functions/roles/DeleteRole';
import './functions/roles/GetRole';
import './functions/roles/ListRoles';
import './functions/roles/UpdateRole';

// Import user functions
import './functions/users/AssignRole';
import './functions/users/GetUserRoles';
import './functions/users/RemoveRole';
import './functions/users/SyncFromAzureAd';

// Export for module resolution
export {};

