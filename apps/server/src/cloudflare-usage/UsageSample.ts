import type { UsageMetricKey } from './UsageMetricKey.js';
import type { UsageReading } from './UsageReading.js';

/** What one check read from Cloudflare. Metrics that could not be read are listed apart. */
export interface UsageSample {
  readings: Partial<Record<UsageMetricKey, UsageReading>>;
  unknownR2Actions: string[];
}
