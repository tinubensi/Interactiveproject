/**
 * Quotation Service
 * Azure Functions Entry Point
 * 
 * This service handles:
 * - Creating quotations from selected plans
 * - Managing quotation lifecycle
 * - Revision and versioning
 * - PDF generation and delivery
 */

// Import all HTTP functions
import './functions/quotations/createQuotation';
import './functions/quotations/getQuotationById';
import './functions/quotations/listQuotations';
import './functions/quotations/changeStatus';
import './functions/quotations/reviseQuotation';

// Import all event handlers
import './functions/events/handlePlansSelected';

console.log('Quotation Service loaded');


