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
import './functions/quotations/sendQuotation';
import './functions/quotations/approveReject';

// Import customer-facing public endpoints
import './functions/customer/getQuotationByToken';
import './functions/customer/selectPlan';

// Import all event handlers
import './functions/events/handlePlansSelected';

console.log('Quotation Service loaded');


