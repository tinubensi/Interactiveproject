/**
 * EMAF Service Entry Point
 * Imports all Azure Functions to register them with the runtime
 */

// Admin functions
import './functions/admin/manageTemplates'; // Combined GET/POST handler for /manage/templates
import './functions/admin/getEmafTemplate';
import './functions/admin/updateEmafTemplate';
import './functions/admin/publishEmafTemplate';
import './functions/admin/uploadVendorPdf'; // Upload vendor PDF template
import './functions/admin/extractQuestions'; // Extract questions from PDF
import './functions/admin/manageFieldMappings'; // Manage PDF field coordinate mappings
import './functions/admin/inspectPdfFields'; // Inspect PDF form fields
import './functions/admin/previewTemplate'; // Preview HTML template (NEW)

// Customer functions
import './functions/customer/getEmafForToken';
import './functions/customer/saveEmafData';
import './functions/customer/requestPdfGeneration';
import './functions/customer/generatePdfDirect'; // Direct PDF generation (no queue)
import './functions/customer/getPdfStatus';
import './functions/customer/renderEmafHtml'; // Render HTML template for client-side PDF generation
import './functions/customer/uploadGeneratedPdf'; // Upload client-generated PDF to blob storage
import './functions/customer/downloadOriginalPdf'; // Download original vendor PDF (NEW)
import './functions/customer/getDocumentUploadUrl'; // Get SAS URL for document upload (NEW)
import './functions/customer/confirmDocumentUpload'; // Confirm upload and save metadata (NEW)
import './functions/customer/getSignedPdfUploadUrl'; // Get SAS URL for signed PDF (NEW)
import './functions/customer/confirmSignedPdfUpload'; // Confirm signed PDF upload (NEW)
import './functions/customer/uploadSignedPdf';
import './functions/customer/uploadDocument';
import './functions/customer/submitForReview';

// Approval functions
// NOTE: listPendingSubmissions MUST be imported before getSubmission
// to ensure /emaf/submissions/pending is registered before /emaf/submissions/{id}
import './functions/approval/listPendingSubmissions'; // MUST BE FIRST - specific route
import './functions/approval/approveSubmission';
import './functions/approval/rejectSubmission';
import './functions/approval/requestRevision';
import './functions/approval/refreshSubmissionSas'; // Refresh SAS URLs for documents
import './functions/approval/getSubmission'; // MUST BE LAST - parameterized route

// Queue functions
import './functions/queue/processPdfGeneration';

// Internal functions (service-to-service)
import './functions/internal/createSubmission';

// Export for module resolution
export {};