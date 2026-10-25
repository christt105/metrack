import type { HealthReport } from '@metrack/domain';

/** Fetches the service health report. */
export async function fetchHealth(fetchFn: typeof fetch = fetch): Promise<HealthReport> {
  const response = await fetchFn('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  return (await response.json()) as HealthReport;
}
