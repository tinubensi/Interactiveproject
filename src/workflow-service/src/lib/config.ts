export interface WorkflowServiceConfig {
  cosmos: {
    endpoint: string;
    key: string;
    databaseId: string;
    workflowDefinitionsContainerId: string;
    workflowInstancesContainerId: string;
    workflowTriggersContainerId: string;
    workflowApprovalsContainerId: string;
    workflowTemplatesContainerId: string;
    workflowCanvasContainerId: string;
  };
  eventGrid: {
    topicEndpoint: string;
    topicKey: string;
  };
  serviceBus: {
    connectionString: string;
  };
  signalr?: {
    connectionString: string;
    serviceBusConnectionString: string;
    hubName: string;
  };
  settings: {
    defaultExecutionRetentionDays: number;
    defaultMaxExecutionDurationSeconds: number;
    instanceTtlSeconds: number;
    approvalTtlSeconds: number;
  };
}

let cachedConfig: WorkflowServiceConfig | undefined;

export const getConfig = (): WorkflowServiceConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  cachedConfig = {
    cosmos: {
      endpoint: process.env.COSMOS_ENDPOINT || '',
      key: process.env.COSMOS_KEY || '',
      databaseId: process.env.COSMOS_DATABASE_ID || 'workflow-db',
      workflowDefinitionsContainerId:
        process.env.COSMOS_WORKFLOW_DEFINITIONS_CONTAINER_ID ||
        'workflow-definitions',
      workflowInstancesContainerId:
        process.env.COSMOS_WORKFLOW_INSTANCES_CONTAINER_ID ||
        'workflow-instances',
      workflowTriggersContainerId:
        process.env.COSMOS_WORKFLOW_TRIGGERS_CONTAINER_ID ||
        'workflow-triggers',
      workflowApprovalsContainerId:
        process.env.COSMOS_WORKFLOW_APPROVALS_CONTAINER_ID ||
        'workflow-approvals',
      workflowTemplatesContainerId:
        process.env.COSMOS_WORKFLOW_TEMPLATES_CONTAINER_ID ||
        'workflow-templates',
      workflowCanvasContainerId:
        process.env.COSMOS_WORKFLOW_CANVAS_CONTAINER_ID ||
        'workflow-canvas'
    },
    eventGrid: {
      topicEndpoint: process.env.EVENT_GRID_TOPIC_ENDPOINT || '',
      topicKey: process.env.EVENT_GRID_TOPIC_KEY || ''
    },
    serviceBus: {
      connectionString: process.env.SERVICE_BUS_CONNECTION_STRING || ''
    },
    signalr: process.env.AZURE_SIGNALR_CONNECTION_STRING
      ? {
          connectionString: process.env.AZURE_SIGNALR_CONNECTION_STRING,
          serviceBusConnectionString:
            process.env.SIGNALR_SERVICE_BUS_CONNECTION_STRING ||
            process.env.SERVICE_BUS_CONNECTION_STRING ||
            '',
          hubName: process.env.SIGNALR_HUB_NAME || 'workflow-hub',
        }
      : undefined,
    settings: {
      defaultExecutionRetentionDays: parseInt(
        process.env.DEFAULT_EXECUTION_RETENTION_DAYS || '90',
        10
      ),
      defaultMaxExecutionDurationSeconds: parseInt(
        process.env.DEFAULT_MAX_EXECUTION_DURATION_SECONDS || '86400',
        10
      ),
      instanceTtlSeconds: parseInt(
        process.env.INSTANCE_TTL_SECONDS || '7776000',
        10
      ), // 90 days
      approvalTtlSeconds: parseInt(
        process.env.APPROVAL_TTL_SECONDS || '604800',
        10
      ) // 7 days
    }
  };

  return cachedConfig;
};

export const resetConfigCache = (): void => {
  cachedConfig = undefined;
};

