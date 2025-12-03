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
export declare const getConfig: () => WorkflowServiceConfig;
export declare const resetConfigCache: () => void;
//# sourceMappingURL=config.d.ts.map