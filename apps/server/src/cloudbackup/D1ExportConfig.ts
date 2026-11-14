export interface D1ExportConfig {
  accountId: string;
  databaseId: string;
  /** Cloudflare API token with D1 Edit, which the export endpoint requires. */
  token: string;
}
