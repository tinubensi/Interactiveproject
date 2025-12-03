import type { AnalyticsPeriod, WorkflowAnalytics, AnalyticsOverview } from '../models/workflowTypes';
export declare function getPeriodRange(period: AnalyticsPeriod, referenceDate?: Date): {
    start: Date;
    end: Date;
};
export declare function getWorkflowAnalytics(workflowId: string, period?: AnalyticsPeriod): Promise<WorkflowAnalytics>;
export declare function getAnalyticsOverview(organizationId: string, period?: AnalyticsPeriod): Promise<AnalyticsOverview>;
//# sourceMappingURL=analyticsAggregator.d.ts.map