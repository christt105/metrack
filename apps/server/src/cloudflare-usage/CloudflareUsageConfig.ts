import type { UsageMetricKey } from './UsageMetricKey.js';

export interface CloudflareUsageConfig {
  token: string;
  accountId: string;
  limits: Record<UsageMetricKey, number>;
  warnPercent: number;
  criticalPercent: number;
}
