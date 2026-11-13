import type { UsageMetricKey } from './UsageMetricKey.js';

/** How a quota is measured and over which UTC period it resets. */
export interface UsageMetricDefinition {
  key: UsageMetricKey;
  label: string;
  period: 'day' | 'month';
  unit: 'count' | 'bytes';
  /** Whether each consumer's share of the total is shown; false when the reading is a maximum, not a sum. */
  showShares: boolean;
}
