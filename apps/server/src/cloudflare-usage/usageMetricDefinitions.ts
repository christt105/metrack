import type { UsageMetricDefinition } from './UsageMetricDefinition.js';

export const usageMetricDefinitions: readonly UsageMetricDefinition[] = [
  {
    key: 'workerRequests',
    label: 'Worker requests',
    period: 'day',
    unit: 'count',
    showShares: true,
  },
  { key: 'd1RowsRead', label: 'D1 rows read', period: 'day', unit: 'count', showShares: true },
  {
    key: 'd1RowsWritten',
    label: 'D1 rows written',
    period: 'day',
    unit: 'count',
    showShares: true,
  },
  {
    key: 'd1Storage',
    label: 'Largest D1 database',
    period: 'month',
    unit: 'bytes',
    showShares: false,
  },
  {
    key: 'r2ClassA',
    label: 'R2 Class A operations',
    period: 'month',
    unit: 'count',
    showShares: true,
  },
  {
    key: 'r2ClassB',
    label: 'R2 Class B operations',
    period: 'month',
    unit: 'count',
    showShares: true,
  },
  { key: 'r2Storage', label: 'R2 storage', period: 'month', unit: 'bytes', showShares: true },
];
