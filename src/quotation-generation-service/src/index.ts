/**
 * Quotation Generation Service
 * Azure Functions Entry Point
 * 
 * This service handles:
 * - Fetching insurance plans from vendors
 * - Plan filtering and comparison
 * - Plan selection for quotation
 */

// Import all HTTP functions
import './functions/plans/fetchPlans';
import './functions/plans/listPlans';
import './functions/plans/getPlanById';
import './functions/plans/selectPlans';
import './functions/filters/saveFilters';
import './functions/filters/getFilters';
import './functions/comparisons/createComparison';
import './functions/comparisons/getComparison';
import './functions/vendors/getVendors';

// Import all event handlers
import './functions/events/handleLeadCreated';

console.log('Quotation Generation Service loaded');


