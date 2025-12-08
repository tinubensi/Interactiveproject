/**
 * Lead Service - Main Entry Point
 * Registers all Azure Functions
 */

// Import all function modules to register them
// Order matters for route registration - GET should come first to avoid conflicts
import './functions/leads/createLead';
import './functions/leads/listLeads';
import './functions/leads/getLeadById'; // GET - register first
import './functions/leads/updateLead'; // PUT
import './functions/leads/deleteLead'; // DELETE
import './functions/leads/changeStage';
import './functions/leads/refetchPlans';

import './functions/timelines/getTimeline';

import './functions/stages/getStages';

import './functions/plans/getLeadPlans';
import './functions/plans/savePlans';

import './functions/metadata/getPetTypes';
import './functions/metadata/getBreeds';
import './functions/metadata/getBreedTypes';
import './functions/metadata/getGenderTypes';
import './functions/metadata/getEmirates';

import './functions/events/handlePlansFetched';
import './functions/events/handleQuotationCreated';
import './functions/events/handlePolicyIssued';

// All functions are auto-registered via app.http() and app.eventGrid() calls
export * from './models/lead';
export * from './models/events';
export * from './models/metadata';
export * from './services/cosmosService';
export * from './services/eventGridService';
export * from './services/metadataService';


