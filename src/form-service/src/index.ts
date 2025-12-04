// Apply polyfills first
import './polyfills';

// This file imports all functions to ensure they are registered with the Azure Functions runtime
// Azure Functions v4 programming model auto-discovers functions when their modules are imported

// Import template functions
import './functions/templates/autoSaveFormTemplate';
import './functions/templates/createFormTemplate';
import './functions/templates/listFormTemplates';
import './functions/templates/getFormTemplate';
import './functions/templates/softDeleteFormTemplate';
import './functions/templates/updateFormTemplate';
import './functions/templates/configureConnectorMappings';

// Import intake functions
import './functions/intakes/autoSaveIntakeForm';
import './functions/intakes/getIntakeForm';
import './functions/intakes/listIntakes';
import './functions/intakes/submitIntakeForm';

// Import event handlers
import './functions/events/renewalInitiatedEventHandler';
import './functions/events/unmappedFieldReportedEventHandler';

// Import portal functions
import './functions/portals/listPortals';
import './functions/portals/getPortal';
import './functions/portals/createPortal';
import './functions/portals/updatePortal';
import './functions/portals/deletePortal';
import './functions/portals/suggestMappings';

// Import unmapped field functions
import './functions/unmapped-fields/listUnmappedFields';
import './functions/unmapped-fields/resolveUnmappedField';
import './functions/unmapped-fields/ignoreUnmappedField';

