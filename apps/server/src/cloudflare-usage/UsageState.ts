/** What the monitor remembers across restarts. */
export interface UsageState {
  /** Highest threshold percent already announced, by `<metric>|<period>`. */
  sent: Record<string, number>;
  /** UTC day of the last notice that the check itself is failing. */
  failureNoticeDay?: string;
}
