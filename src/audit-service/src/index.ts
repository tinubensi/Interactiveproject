/**
 * Audit Service - Function Exports
 * 
 * This file imports all function handlers to ensure they are registered
 * with the Azure Functions runtime.
 */

// Import all function handlers
import './functions/CreateAuditLog';
import './functions/CreateExport';
import './functions/EventHandler';
import './functions/GenerateDailySummary';
import './functions/GetAuditByEntity';
import './functions/GetAuditByUser';
import './functions/GetExportStatus';
import './functions/GetStats';
import './functions/Health';
import './functions/SearchAudit';

// Export for module resolution
export {};

