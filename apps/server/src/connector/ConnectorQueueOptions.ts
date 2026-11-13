export interface ConnectorQueueOptions {
  /** Quiet time between a webhook and the sync it asks for, so Jellystat has recorded the playback. */
  debounceMs: number;
}
