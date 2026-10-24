export type HealthStatus = 'ok' | 'degraded';

export interface HealthReport {
  status: HealthStatus;
  appVersion: string;
  schemaVersion: number;
}
