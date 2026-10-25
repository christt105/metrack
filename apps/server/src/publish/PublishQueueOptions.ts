export interface PublishQueueOptions {
  /** Wait after a change before publishing, so a burst of edits is one deploy. */
  debounceMs: number;
  /** First retry delay after a failure. It doubles with each further failure. */
  baseDelayMs: number;
  maxDelayMs: number;
}
