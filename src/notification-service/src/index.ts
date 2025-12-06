/**
 * Notification Service - Function Exports
 * 
 * This file imports all function handlers to ensure they are registered
 * with the Azure Functions runtime.
 */

// Import health check
import './functions/Health';

// Import user notification functions
import './functions/user/DeleteNotification';
import './functions/user/GetUserNotifications';
import './functions/user/MarkNotificationRead';
import './functions/user/GetUnreadCount';
import './functions/user/MarkAllRead';

// Import realtime functions
import './functions/realtime/Negotiate';

// Import event handlers
import './functions/events/SecurityEventHandler';
import './functions/events/WorkflowEventHandler';

// Import template functions
import './functions/templates/ListTemplates';
import './functions/templates/CreateTemplate';
import './functions/templates/GetTemplate';
import './functions/templates/PreviewTemplate';
import './functions/templates/UpdateTemplate';
import './functions/templates/DeleteTemplate';

// Import send functions
import './functions/send/SendBatchNotification';
import './functions/send/SendNotification';

// Import preference functions
import './functions/preferences/GetPreferences';
import './functions/preferences/UpdatePreferences';

// Export for module resolution
export {};

