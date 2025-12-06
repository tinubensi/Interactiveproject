/**
 * Staff Management Service - Function Exports
 * 
 * This file imports all function handlers to ensure they are registered
 * with the Azure Functions runtime.
 */

// Import health check
import './functions/Health';

// Import event handlers
import './functions/events/CustomerCreatedHandler';
import './functions/events/PolicyIssuedHandler';
import './functions/events/LeadCreatedHandler';

// Import staff functions
import './functions/staff/CreateStaff';
import './functions/staff/UpdateStaff';
import './functions/staff/GetStaff';
import './functions/staff/ListStaff';
import './functions/staff/GetStaffByEmail';
import './functions/staff/UpdateStaffStatus';

// Import team functions
import './functions/teams/CreateTeam';
import './functions/teams/UpdateTeam';
import './functions/teams/ListTeams';
import './functions/teams/DeleteTeam';
import './functions/teams/GetTeam';
import './functions/teams/AddTeamMember';
import './functions/teams/RemoveTeamMember';

// Import assignment functions
import './functions/assignment/FindStaffForAssignment';

// Import territory functions
import './functions/territories/ListTerritories';
import './functions/territories/AssignTerritory';

// Import scheduled functions
import './functions/scheduled/LicenseExpiryCheck';

// Import workload functions
import './functions/workload/GetStaffPerformance';
import './functions/workload/GetStaffWorkload';

// Export for module resolution
export {};

