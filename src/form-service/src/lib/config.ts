export interface CosmosConfig {
  endpoint: string;
  key: string;
  databaseId: string;
  formDefinitionsContainerId: string;
  intakeFormsContainerId: string;
  portalRegistryContainerId: string;
  unmappedFieldsContainerId: string;
}

export interface EventGridConfig {
  topicEndpoint: string;
  topicKey: string;
}

export interface AuthConfig {
  allowedAudience?: string;
  requiredRoles?: string[];
}

export interface AppConfig {
  cosmos: CosmosConfig;
  eventGrid: EventGridConfig;
  auth?: AuthConfig;
}

export const getConfig = (): AppConfig => {
  const {
    COSMOS_DB_ENDPOINT,
    COSMOS_DB_KEY,
    COSMOS_DB_NAME = 'FormDB',
    COSMOS_FORM_DEFINITIONS_CONTAINER = 'form-definitions',
    COSMOS_INTAKE_FORMS_CONTAINER = 'intake-forms',
    COSMOS_PORTAL_REGISTRY_CONTAINER = 'portal-registry',
    COSMOS_UNMAPPED_FIELDS_CONTAINER = 'unmapped-fields',
    EVENT_GRID_TOPIC_ENDPOINT = '',
    EVENT_GRID_TOPIC_KEY = '',
    AUTH_AUDIENCE,
    AUTH_REQUIRED_ROLES
  } = process.env;

  if (!COSMOS_DB_ENDPOINT || !COSMOS_DB_KEY) {
    throw new Error('COSMOS_DB_ENDPOINT and COSMOS_DB_KEY must be configured');
  }

  return {
    cosmos: {
      endpoint: COSMOS_DB_ENDPOINT,
      key: COSMOS_DB_KEY,
      databaseId: COSMOS_DB_NAME,
      formDefinitionsContainerId: COSMOS_FORM_DEFINITIONS_CONTAINER,
      intakeFormsContainerId: COSMOS_INTAKE_FORMS_CONTAINER,
      portalRegistryContainerId: COSMOS_PORTAL_REGISTRY_CONTAINER,
      unmappedFieldsContainerId: COSMOS_UNMAPPED_FIELDS_CONTAINER
    },
    eventGrid: {
      topicEndpoint: EVENT_GRID_TOPIC_ENDPOINT,
      topicKey: EVENT_GRID_TOPIC_KEY
    },
    auth: AUTH_AUDIENCE
      ? {
          allowedAudience: AUTH_AUDIENCE,
          requiredRoles: AUTH_REQUIRED_ROLES
            ? AUTH_REQUIRED_ROLES.split(',').map((role) => role.trim())
            : undefined
        }
      : undefined
  };
};

