/** Identifies one Cloudflare quota the monitor watches. */
export type UsageMetricKey =
  | 'workerRequests'
  | 'd1RowsRead'
  | 'd1RowsWritten'
  | 'd1Storage'
  | 'r2ClassA'
  | 'r2ClassB'
  | 'r2Storage';
