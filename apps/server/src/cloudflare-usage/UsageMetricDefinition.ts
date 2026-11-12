import type { UsageMetricKey } from './UsageMetricKey.js';

/** How a quota is measured and over which UTC period it resets. */
export interface UsageMetricDefinition {
  key: UsageMetricKey;
  label: string;
  period: 'day' | 'month';
  unit: 'count' | 'bytes';
}
