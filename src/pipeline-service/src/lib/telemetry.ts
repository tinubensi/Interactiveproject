/**
 * Telemetry Module for Application Insights
 * Tracks pipeline events and metrics for observability
 */

import * as appInsights from 'applicationinsights';

let client: appInsights.TelemetryClient | null = null;

/**
 * Initialize Application Insights telemetry
 * Should be called once at application startup
 */
export function initTelemetry(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  
  if (!connectionString) {
    console.warn('⚠️ APPLICATIONINSIGHTS_CONNECTION_STRING not set - telemetry disabled');
    console.warn('   Set this environment variable to enable Application Insights tracking');
    return;
  }

  try {
    appInsights.setup(connectionString).start();
    client = appInsights.defaultClient;
    console.log('✅ Application Insights telemetry initialized');
  } catch (error) {
    console.error('❌ Failed to initialize Application Insights:', error);
  }
}

/**
 * Track a custom pipeline event
 * @param eventName - Name of the event (e.g., 'PipelineInstanceCreated')
 * @param properties - Event properties for filtering and analysis
 */
export function trackPipelineEvent(
  eventName: string,
  properties: Record<string, string | number | boolean>
): void {
  if (!client) {
    return; // Silently skip if telemetry not initialized
  }

  try {
    client.trackEvent({
      name: eventName,
      properties: properties as Record<string, string>,
    });
  } catch (error) {
    console.error(`Failed to track event ${eventName}:`, error);
  }
}

/**
 * Track a custom pipeline metric
 * @param metricName - Name of the metric (e.g., 'pipeline.step.duration')
 * @param value - Numeric value of the metric
 * @param properties - Optional properties for filtering
 */
export function trackPipelineMetric(
  metricName: string,
  value: number,
  properties?: Record<string, string>
): void {
  if (!client) {
    return; // Silently skip if telemetry not initialized
  }

  try {
    client.trackMetric({
      name: metricName,
      value,
      properties,
    });
  } catch (error) {
    console.error(`Failed to track metric ${metricName}:`, error);
  }
}

/**
 * Track an exception
 * @param error - Error object
 * @param properties - Optional context properties
 */
export function trackException(
  error: Error,
  properties?: Record<string, string>
): void {
  if (!client) {
    return;
  }

  try {
    client.trackException({
      exception: error,
      properties,
    });
  } catch (err) {
    console.error('Failed to track exception:', err);
  }
}

/**
 * Track a dependency call (external service)
 * @param name - Name of the dependency
 * @param data - Request data
 * @param duration - Duration in milliseconds
 * @param success - Whether the call succeeded
 * @param properties - Optional properties
 */
export function trackDependency(
  name: string,
  data: string,
  duration: number,
  success: boolean,
  properties?: Record<string, string>
): void {
  if (!client) {
    return;
  }

  try {
    client.trackDependency({
      name,
      data,
      duration,
      success,
      resultCode: success ? 200 : 500,
      dependencyTypeName: 'HTTP',
      properties,
    });
  } catch (error) {
    console.error(`Failed to track dependency ${name}:`, error);
  }
}

