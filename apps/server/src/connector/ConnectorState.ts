/** What the connector remembers between runs: who it last saw in the cloud, and who is waiting for a sync. */
export interface ConnectorState {
  /** Ids of the users with a Jellyfin account, as of the last full pass. */
  users: number[];
  /** Users waiting for a sync, by id: when it is due (epoch ms) and how many attempts in a row failed. */
  pending: Record<string, { dueAt: number; failures: number }>;
}
