import type { HealthReport } from './HealthReport.js';

/**
 * Builds the health report. The service is healthy only when at least one
 * schema migration has been applied.
 */
export function createHealthReport(appVersion: string, schemaVersion: number): HealthReport {
  return {
    status: schemaVersion > 0 ? 'ok' : 'degraded',
    appVersion,
    schemaVersion,
  };
}
