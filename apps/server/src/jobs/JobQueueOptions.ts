export interface JobQueueOptions {
  /** Wait after a change before running, so a burst of edits is one run. */
  debounceMs: number;
  /** First retry delay after a failure. It doubles with each further failure. */
  baseDelayMs: number;
  maxDelayMs: number;
  /** What the queue does, for logs and alerts. */
  label?: string;
}
