import { getCosmosContainers } from './cosmosClient';
import type {
  AnalyticsPeriod,
  WorkflowAnalytics,
  AnalyticsOverview,
  StepAnalytics,
  ApprovalAnalytics,
  WorkflowInstance,
  WorkflowDefinition,
} from '../models/workflowTypes';

// ----------------------------------------------------------------------------
// Period Calculations
// ----------------------------------------------------------------------------

export function getPeriodRange(
  period: AnalyticsPeriod,
  referenceDate: Date = new Date()
): { start: Date; end: Date } {
  const end = new Date(referenceDate);
  end.setHours(23, 59, 59, 999);

  const start = new Date(referenceDate);
  start.setHours(0, 0, 0, 0);

  switch (period) {
    case 'day':
      // Same day
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setDate(start.getDate() - 30);
      break;
  }

  return { start, end };
}

// ----------------------------------------------------------------------------
// Percentile Calculation
// ----------------------------------------------------------------------------

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}

// ----------------------------------------------------------------------------
// Workflow Analytics
// ----------------------------------------------------------------------------

export async function getWorkflowAnalytics(
  workflowId: string,
  period: AnalyticsPeriod = 'week'
): Promise<WorkflowAnalytics> {
  const containers = await getCosmosContainers();
  const { start, end } = getPeriodRange(period);

  // Get workflow definition for name
  const workflowQuery = {
    query: `
      SELECT TOP 1 c.name FROM c 
      WHERE c.workflowId = @workflowId
      ORDER BY c.version DESC
    `,
    parameters: [{ name: '@workflowId', value: workflowId }],
  };

  const { resources: workflows } = await containers.workflowDefinitions.items
    .query<{ name: string }>(workflowQuery)
    .fetchAll();

  const workflowName = workflows[0]?.name || workflowId;

  // Get instances for the period
  const instancesQuery = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId
      AND c.startedAt >= @startDate
      AND c.startedAt <= @endDate
    `,
    parameters: [
      { name: '@workflowId', value: workflowId },
      { name: '@startDate', value: start.toISOString() },
      { name: '@endDate', value: end.toISOString() },
    ],
  };

  const { resources: instances } = await containers.workflowInstances.items
    .query<WorkflowInstance>(instancesQuery)
    .fetchAll();

  // Calculate metrics
  const totalExecutions = instances.length;
  const completedInstances = instances.filter((i) => i.status === 'completed');
  const failedInstances = instances.filter((i) => i.status === 'failed');
  const cancelledInstances = instances.filter((i) => i.status === 'cancelled');

  const durations = completedInstances
    .filter((i) => i.startedAt && i.completedAt)
    .map((i) => {
      const start = new Date(i.startedAt!).getTime();
      const end = new Date(i.completedAt!).getTime();
      return end - start;
    });

  const avgDurationMs = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // Calculate step metrics
  const stepMetricsMap = new Map<string, {
    executions: number;
    successes: number;
    failures: number;
    durations: number[];
    name: string;
    type: string;
  }>();

  for (const instance of instances) {
    if (instance.stepExecutions) {
      for (const entry of instance.stepExecutions) {
        const existing = stepMetricsMap.get(entry.stepId) || {
          executions: 0,
          successes: 0,
          failures: 0,
          durations: [],
          name: entry.stepName,
          type: entry.stepType,
        };

        existing.executions++;
        if (entry.status === 'completed') {
          existing.successes++;
          if (entry.durationMs) {
            existing.durations.push(entry.durationMs);
          }
        } else if (entry.status === 'failed') {
          existing.failures++;
        }

        stepMetricsMap.set(entry.stepId, existing);
      }
    }
  }

  const stepMetrics: StepAnalytics[] = Array.from(stepMetricsMap.entries()).map(
    ([stepId, data]) => ({
      stepId,
      stepName: data.name,
      stepType: data.type as StepAnalytics['stepType'],
      executionCount: data.executions,
      successCount: data.successes,
      failureCount: data.failures,
      avgDurationMs: data.durations.length > 0
        ? data.durations.reduce((a, b) => a + b, 0) / data.durations.length
        : 0,
      p50DurationMs: calculatePercentile(data.durations, 50),
      p95DurationMs: calculatePercentile(data.durations, 95),
      errorRate: data.executions > 0
        ? (data.failures / data.executions) * 100
        : 0,
    })
  );

  // Calculate approval metrics if applicable
  let approvalMetrics: ApprovalAnalytics | undefined;
  const approvalsQuery = {
    query: `
      SELECT * FROM c 
      WHERE c.workflowId = @workflowId
      AND c.requestedAt >= @startDate
      AND c.requestedAt <= @endDate
    `,
    parameters: [
      { name: '@workflowId', value: workflowId },
      { name: '@startDate', value: start.toISOString() },
      { name: '@endDate', value: end.toISOString() },
    ],
  };

  const { resources: approvals } = await containers.workflowApprovals.items
    .query(approvalsQuery)
    .fetchAll();

  if (approvals.length > 0) {
    const approved = approvals.filter((a) => a.status === 'approved');
    const rejected = approvals.filter((a) => a.status === 'rejected');
    const pending = approvals.filter((a) => a.status === 'pending');
    const escalated = approvals.filter((a) => a.escalatedAt);

    const decisionTimes = approvals
      .filter((a) => a.status !== 'pending' && a.requestedAt)
      .map((a) => {
        const decision = a.decisions?.[0];
        if (!decision?.decidedAt) return 0;
        return new Date(decision.decidedAt).getTime() - new Date(a.requestedAt).getTime();
      })
      .filter((t) => t > 0);

    approvalMetrics = {
      totalApprovals: approvals.length,
      approvedCount: approved.length,
      rejectedCount: rejected.length,
      pendingCount: pending.length,
      avgDecisionTimeMs: decisionTimes.length > 0
        ? decisionTimes.reduce((a, b) => a + b, 0) / decisionTimes.length
        : 0,
      escalationRate: approvals.length > 0
        ? (escalated.length / approvals.length) * 100
        : 0,
    };
  }

  return {
    workflowId,
    workflowName,
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totalExecutions,
    completedExecutions: completedInstances.length,
    failedExecutions: failedInstances.length,
    cancelledExecutions: cancelledInstances.length,
    avgDurationMs,
    p50DurationMs: calculatePercentile(durations, 50),
    p95DurationMs: calculatePercentile(durations, 95),
    successRate: totalExecutions > 0
      ? (completedInstances.length / totalExecutions) * 100
      : 0,
    stepMetrics,
    approvalMetrics,
  };
}

// ----------------------------------------------------------------------------
// Analytics Overview
// ----------------------------------------------------------------------------

export async function getAnalyticsOverview(
  organizationId: string,
  period: AnalyticsPeriod = 'week'
): Promise<AnalyticsOverview> {
  const containers = await getCosmosContainers();
  const { start, end } = getPeriodRange(period);

  // Get workflows for organization
  const workflowsQuery = {
    query: `
      SELECT c.workflowId, c.name, c.status FROM c 
      WHERE c.organizationId = @organizationId
      AND (c.isDeleted = false OR NOT IS_DEFINED(c.isDeleted))
    `,
    parameters: [{ name: '@organizationId', value: organizationId }],
  };

  const { resources: workflowDefs } = await containers.workflowDefinitions.items
    .query<{ workflowId: string; name: string; status: string }>(workflowsQuery)
    .fetchAll();

  // Deduplicate by workflowId (keep latest)
  const workflowMap = new Map<string, { name: string; status: string }>();
  for (const wf of workflowDefs) {
    workflowMap.set(wf.workflowId, { name: wf.name, status: wf.status });
  }

  const totalWorkflows = workflowMap.size;
  const activeWorkflows = Array.from(workflowMap.values()).filter(
    (w) => w.status === 'active'
  ).length;

  // Get instances for the period
  const instancesQuery = {
    query: `
      SELECT c.workflowId, c.status, c.startedAt, c.completedAt FROM c 
      WHERE c.organizationId = @organizationId
      AND c.startedAt >= @startDate
      AND c.startedAt <= @endDate
    `,
    parameters: [
      { name: '@organizationId', value: organizationId },
      { name: '@startDate', value: start.toISOString() },
      { name: '@endDate', value: end.toISOString() },
    ],
  };

  const { resources: instances } = await containers.workflowInstances.items
    .query<{ workflowId: string; status: string; startedAt: string; completedAt?: string }>(
      instancesQuery
    )
    .fetchAll();

  const totalExecutions = instances.length;
  const completedInstances = instances.filter((i) => i.status === 'completed');

  const durations = completedInstances
    .filter((i) => i.completedAt)
    .map((i) => {
      const startTime = new Date(i.startedAt).getTime();
      const endTime = new Date(i.completedAt!).getTime();
      return endTime - startTime;
    });

  const avgDurationMs = durations.length > 0
    ? durations.reduce((a, b) => a + b, 0) / durations.length
    : 0;

  // Calculate top workflows by execution count
  const workflowExecutions = new Map<string, { count: number; completed: number }>();
  for (const instance of instances) {
    const existing = workflowExecutions.get(instance.workflowId) || { count: 0, completed: 0 };
    existing.count++;
    if (instance.status === 'completed') {
      existing.completed++;
    }
    workflowExecutions.set(instance.workflowId, existing);
  }

  const topWorkflows = Array.from(workflowExecutions.entries())
    .map(([workflowId, data]) => ({
      workflowId,
      workflowName: workflowMap.get(workflowId)?.name || workflowId,
      executionCount: data.count,
      successRate: data.count > 0 ? (data.completed / data.count) * 100 : 0,
    }))
    .sort((a, b) => b.executionCount - a.executionCount)
    .slice(0, 10);

  return {
    organizationId,
    period,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    totalWorkflows,
    activeWorkflows,
    totalExecutions,
    successRate: totalExecutions > 0
      ? (completedInstances.length / totalExecutions) * 100
      : 0,
    avgDurationMs,
    topWorkflows,
    slowestSteps: [], // Would require deeper analysis
    failingSteps: [], // Would require deeper analysis
  };
}

