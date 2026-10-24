/** Days before stored metadata is considered stale, by how settled the title is. */
export interface ExpiryPolicy {
  /** A title is "recent" from this many days before until this many days after its release date. */
  recentWindowDays: number;
  recentTtlDays: number;
  defaultTtlDays: number;
  finishedTtlDays: number;
}
