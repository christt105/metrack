/** What every user's content version adds up to, and how many users there are. */
export interface GlobalContentVersion {
  /** The sum of the counters of all users. */
  total: number;
  /** How many users exist, so deleting one changes the fingerprint even though it lowers the sum. */
  users: number;
}
