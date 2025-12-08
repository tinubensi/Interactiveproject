/**
 * Document Service - Function Exports
 * 
 * This file imports all function handlers to ensure they are registered
 * with the Azure Functions runtime.
 */

// Import all function handlers
import './functions/ConfirmUpload';
import './functions/GetDownloadUrl';
import './functions/ListDocuments';
import './functions/CreateDocument';
import './functions/DeleteDocument';
import './functions/DocumentChangeFeed';

// Export for module resolution
export {};

