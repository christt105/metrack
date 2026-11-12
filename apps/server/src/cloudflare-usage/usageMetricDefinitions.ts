import type { UsageMetricDefinition } from './UsageMetricDefinition.js';

export const usageMetricDefinitions: readonly UsageMetricDefinition[] = [
  { key: 'workerRequests', label: 'Worker requests', period: 'day', unit: 'count' },
  { key: 'd1RowsRead', label: 'D1 rows read', period: 'day', unit: 'count' },
  { key: 'd1RowsWritten', label: 'D1 rows written', period: 'day', unit: 'count' },
  { key: 'd1Storage', label: 'D1 storage', period: 'day', unit: 'bytes' },
  { key: 'r2ClassA', label: 'R2 Class A operations', period: 'month', unit: 'count' },
  { key: 'r2ClassB', label: 'R2 Class B operations', period: 'month', unit: 'count' },
  { key: 'r2Storage', label: 'R2 storage', period: 'day', unit: 'bytes' },
];
